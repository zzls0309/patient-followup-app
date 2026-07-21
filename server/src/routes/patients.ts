import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// GET /api/v1/patients - 获取所有患者列表
router.get('/', async (_req, res) => {
  try {
    const client = getSupabaseClient();

    // 获取所有患者
    const { data: patients, error: patientsError } = await client
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    if (patientsError) throw new Error(`查询失败: ${patientsError.message}`);

    if (!patients || patients.length === 0) {
      return res.json([]);
    }

    // 批量获取所有步骤
    const patientIds = patients.map(p => p.id);
    const { data: allSteps, error: stepsError } = await client
      .from('followup_steps')
      .select('*')
      .in('patient_id', patientIds)
      .order('step_number', { ascending: true });
    if (stepsError) throw new Error(`查询步骤失败: ${stepsError.message}`);

    // 组装数据
    const result = patients.map(p => {
      const steps = (allSteps || []).filter(s => s.patient_id === p.id);
      const completedSteps = steps.filter(s => s.completed_date != null).length;
      const totalSteps = steps.length;
      const pendingSteps = steps.filter(s => s.completed_date == null);
      const nextStepDate = pendingSteps.length > 0
        ? pendingSteps.reduce((earliest, s) => s.scheduled_date < earliest.scheduled_date ? s : earliest).scheduled_date
        : null;

      return {
        ...p,
        completed_steps: completedSteps.toString(),
        total_steps: totalSteps.toString(),
        next_step_date: nextStepDate,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/v1/patients/reminders/upcoming - 获取即将到期和已逾期的随访步骤
// 必须在 /:id 之前定义
router.get('/reminders/upcoming', async (_req, res) => {
  try {
    const client = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 获取未完成且计划日期在7天内的步骤
    const { data: steps, error: stepsError } = await client
      .from('followup_steps')
      .select('*')
      .is('completed_date', null)
      .lte('scheduled_date', sevenDaysLater)
      .order('scheduled_date', { ascending: true });
    if (stepsError) throw new Error(`查询失败: ${stepsError.message}`);

    if (!steps || steps.length === 0) {
      return res.json([]);
    }

    // 获取关联的患者信息
    const patientIds = [...new Set(steps.map(s => s.patient_id))];
    const { data: patients, error: patientsError } = await client
      .from('patients')
      .select('id, name, phone')
      .in('id', patientIds);
    if (patientsError) throw new Error(`查询患者失败: ${patientsError.message}`);

    const patientMap = new Map((patients || []).map(p => [p.id, p]));

    const result = steps.map(s => {
      const patient = patientMap.get(s.patient_id);
      return {
        ...s,
        patient_name: patient?.name || '未知',
        patient_phone: patient?.phone || '',
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching reminders:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// GET /api/v1/patients/:id - 获取单个患者详情（含随访步骤）
router.get('/:id', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { id } = req.params;

    const { data: patient, error: patientError } = await client
      .from('patients')
      .select('*')
      .eq('id', parseInt(id))
      .maybeSingle();
    if (patientError) throw new Error(`查询失败: ${patientError.message}`);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { data: steps, error: stepsError } = await client
      .from('followup_steps')
      .select('*')
      .eq('patient_id', parseInt(id))
      .order('step_number', { ascending: true });
    if (stepsError) throw new Error(`查询步骤失败: ${stepsError.message}`);

    res.json({ ...patient, steps: steps || [] });
  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// POST /api/v1/patients - 创建患者（同时创建4个随访步骤）
router.post('/', async (req, res) => {
  const { name, phone, gender, age, notes, firstTreatmentDate } = req.body;
  if (!name || !firstTreatmentDate) {
    return res.status(400).json({ error: 'Name and firstTreatmentDate are required' });
  }

  try {
    const client = getSupabaseClient();

    // 创建患者
    const { data: patient, error: patientError } = await client
      .from('patients')
      .insert({
        name,
        phone: phone || '',
        gender: gender || '',
        age: age || 0,
        notes: notes || '',
      })
      .select()
      .single();
    if (patientError) throw new Error(`创建患者失败: ${patientError.message}`);

    // 创建4个随访步骤，间隔28天
    const stepTypes = ['treatment_1', 'treatment_2', 'treatment_3', 'photo'];
    const baseDate = new Date(firstTreatmentDate);

    const stepsToInsert = stepTypes.map((stepType, i) => {
      const scheduledDate = new Date(baseDate);
      scheduledDate.setDate(baseDate.getDate() + i * 28);
      return {
        patient_id: patient.id,
        step_number: i + 1,
        step_type: stepType,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
      };
    });

    const { error: stepsError } = await client
      .from('followup_steps')
      .insert(stepsToInsert);
    if (stepsError) throw new Error(`创建步骤失败: ${stepsError.message}`);

    // 返回完整数据
    const { data: steps, error: fetchStepsError } = await client
      .from('followup_steps')
      .select('*')
      .eq('patient_id', patient.id)
      .order('step_number', { ascending: true });
    if (fetchStepsError) throw new Error(`查询步骤失败: ${fetchStepsError.message}`);

    res.status(201).json({ ...patient, steps: steps || [] });
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// PUT /api/v1/patients/:id - 更新患者信息
router.put('/:id', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { id } = req.params;
    const { name, phone, gender, age, notes } = req.body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (gender !== undefined) updateData.gender = gender;
    if (age !== undefined) updateData.age = age;
    if (notes !== undefined) updateData.notes = notes;

    const { data: patient, error } = await client
      .from('patients')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();
    if (error) throw new Error(`更新失败: ${error.message}`);

    res.json(patient);
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// DELETE /api/v1/patients/:id - 删除患者（级联删除步骤）
router.delete('/:id', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { id } = req.params;

    // 先删除步骤
    const { error: stepsError } = await client
      .from('followup_steps')
      .delete()
      .eq('patient_id', parseInt(id));
    if (stepsError) throw new Error(`删除步骤失败: ${stepsError.message}`);

    // 再删除患者
    const { data: patient, error: patientError } = await client
      .from('patients')
      .delete()
      .eq('id', parseInt(id))
      .select()
      .single();
    if (patientError) throw new Error(`删除患者失败: ${patientError.message}`);

    res.json({ message: 'Patient deleted', patient });
  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

// PUT /api/v1/patients/:patientId/steps/:stepId - 更新随访步骤
router.put('/:patientId/steps/:stepId', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { stepId } = req.params;
    const { completed_date, scheduled_date, notes } = req.body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (completed_date !== undefined) updateData.completed_date = completed_date;
    if (scheduled_date !== undefined) updateData.scheduled_date = scheduled_date;
    if (notes !== undefined) updateData.notes = notes;

    const { data: step, error } = await client
      .from('followup_steps')
      .update(updateData)
      .eq('id', parseInt(stepId))
      .select()
      .single();
    if (error) throw new Error(`更新步骤失败: ${error.message}`);

    res.json(step);
  } catch (err) {
    console.error('Error updating step:', err);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

export default router;
