import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 步骤类型配置
const STEP_TYPES = ['treatment_1', 'treatment_2', 'treatment_3', 'photo'] as const;
const STEP_INTERVAL_DAYS = 28;

// 北京时间获取今天的日期字符串 (YYYY-MM-DD)
function getTodayBJ(): string {
  const now = new Date();
  const bjOffset = 8 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjTime = new Date(utc + bjOffset * 60000);
  return bjTime.toISOString().split('T')[0];
}

// 从日期字符串生成北京时间日期对象
function parseDateBJ(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 日期格式化
function formatDateBJ(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 根据起始日期生成4个步骤的计划日期
function generateStepDates(firstDate: string): { step_type: string; step_number: number; scheduled_date: string }[] {
  const base = parseDateBJ(firstDate);
  return STEP_TYPES.map((stepType, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i * STEP_INTERVAL_DAYS);
    return {
      step_type: stepType,
      step_number: i + 1,
      scheduled_date: formatDateBJ(d),
    };
  });
}

// GET /api/v1/patients - 获取所有患者列表
router.get('/', async (_req, res) => {
  try {
    const client = getSupabaseClient();
    const { data: patients, error: patientsError } = await client
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    if (patientsError) throw new Error(`查询失败: ${patientsError.message}`);
    if (!patients || patients.length === 0) return res.json([]);

    const patientIds = patients.map(p => p.id);
    const { data: allSteps, error: stepsError } = await client
      .from('followup_steps')
      .select('*')
      .in('patient_id', patientIds)
      .order('step_number', { ascending: true });
    if (stepsError) throw new Error(`查询步骤失败: ${stepsError.message}`);

    const result = patients.map(p => {
      const steps = (allSteps || []).filter(s => s.patient_id === p.id);
      const completedSteps = steps.filter(s => s.completed_date != null).length;
      const totalSteps = steps.length;
      const pendingSteps = steps.filter(s => s.completed_date == null);
      const nextStepDate = pendingSteps.length > 0
        ? pendingSteps.reduce((e, s) => s.scheduled_date < e.scheduled_date ? s : e).scheduled_date
        : null;
      return { ...p, completed_steps: completedSteps.toString(), total_steps: totalSteps.toString(), next_step_date: nextStepDate };
    });
    res.json(result);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/v1/patients/reminders/upcoming - 获取提前2天及已逾期的随访步骤
router.get('/reminders/upcoming', async (_req, res) => {
  try {
    const client = getSupabaseClient();
    const today = getTodayBJ();
    const twoDaysLater = formatDateBJ(new Date(parseDateBJ(today).getTime() + 2 * 86400000));

    const { data: steps, error: stepsError } = await client
      .from('followup_steps')
      .select('*')
      .is('completed_date', null)
      .lte('scheduled_date', twoDaysLater)
      .order('scheduled_date', { ascending: true });
    if (stepsError) throw new Error(`查询失败: ${stepsError.message}`);
    if (!steps || steps.length === 0) return res.json([]);

    const patientIds = [...new Set(steps.map(s => s.patient_id))];
    const { data: patients, error: patientsError } = await client
      .from('patients')
      .select('id, name, phone')
      .in('id', patientIds);
    if (patientsError) throw new Error(`查询患者失败: ${patientsError.message}`);
    const patientMap = new Map((patients || []).map(p => [p.id, p]));

    const result = steps.map(s => ({
      ...s,
      patient_name: patientMap.get(s.patient_id)?.name || '未知',
      patient_phone: patientMap.get(s.patient_id)?.phone || '',
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching reminders:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// GET /api/v1/patients/calendar - 获取日历数据（当月+下月）
router.get('/calendar', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    // 计算当月和下月的日期范围
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-31`;

    const { data: steps, error: stepsError } = await client
      .from('followup_steps')
      .select('id, patient_id, step_number, step_type, scheduled_date, completed_date')
      .is('completed_date', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true });
    if (stepsError) throw new Error(`查询失败: ${stepsError.message}`);
    if (!steps || steps.length === 0) return res.json([]);

    const patientIds = [...new Set(steps.map(s => s.patient_id))];
    const { data: patients, error: patientsError } = await client
      .from('patients')
      .select('id, name')
      .in('id', patientIds);
    if (patientsError) throw new Error(`查询患者失败: ${patientsError.message}`);
    const patientMap = new Map((patients || []).map(p => [p.id, p]));

    // 按日期分组
    const stepLabels: Record<string, string> = {
      treatment_1: '首次', treatment_2: '二次', treatment_3: '三次', photo: '拍照',
    };
    const dateMap: Record<string, { patient_name: string; step_label: string; step_type: string; patient_id: number }[]> = {};
    for (const s of steps) {
      const date = s.scheduled_date;
      if (!dateMap[date]) dateMap[date] = [];
      dateMap[date].push({
        patient_name: patientMap.get(s.patient_id)?.name || '未知',
        step_label: stepLabels[s.step_type] || s.step_type,
        step_type: s.step_type,
        patient_id: s.patient_id,
      });
    }
    res.json(dateMap);
  } catch (err) {
    console.error('Error fetching calendar:', err);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// GET /api/v1/patients/calendar/day?date=YYYY-MM-DD - 获取某日随诊患者详情
router.get('/calendar/day', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
    }

    const { data: steps, error: stepsError } = await client
      .from('followup_steps')
      .select('id, patient_id, step_type, scheduled_date')
      .is('completed_date', null)
      .eq('scheduled_date', date)
      .order('step_number', { ascending: true });
    if (stepsError) throw new Error(`查询失败: ${stepsError.message}`);
    if (!steps || steps.length === 0) return res.json([]);

    const patientIds = [...new Set(steps.map(s => s.patient_id))];
    const { data: patients, error: patientsError } = await client
      .from('patients')
      .select('id, name, phone')
      .in('id', patientIds);
    if (patientsError) throw new Error(`查询患者失败: ${patientsError.message}`);
    const patientMap = new Map((patients || []).map(p => [p.id, p]));

    const stepLabels: Record<string, string> = {
      treatment_1: '首次治疗', treatment_2: '二次治疗', treatment_3: '三次治疗', photo: '拍照随访',
    };
    const result = steps.map(s => ({
      patient_id: s.patient_id,
      patient_name: patientMap.get(s.patient_id)?.name || '未知',
      phone: patientMap.get(s.patient_id)?.phone || '',
      step_type: s.step_type,
      step_label: stepLabels[s.step_type] || s.step_type,
      scheduled_date: s.scheduled_date,
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching day patients:', err);
    res.status(500).json({ error: 'Failed to fetch day patients' });
  }
});

// POST /api/v1/patients/import - Excel批量导入患者
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const client = getSupabaseClient();
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) return res.status(400).json({ error: 'Excel文件为空' });

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel行号（含表头）
      const name = String(row['姓名'] || row['name'] || '').trim();
      const phone = String(row['电话'] || row['手机'] || row['phone'] || '').trim();
      const gender = String(row['性别'] || row['gender'] || '').trim();
      const age = parseInt(String(row['年龄'] || row['age'] || '0'));
      const notes = String(row['备注'] || row['notes'] || '').trim();
      const firstDate = String(row['首次治疗日期'] || row['firstTreatmentDate'] || row['首次治疗'] || '').trim();
      const secondDate = String(row['二次治疗日期'] || row['secondTreatmentDate'] || row['二次治疗'] || '').trim();
      const thirdDate = String(row['三次治疗日期'] || row['thirdTreatmentDate'] || row['三次治疗'] || '').trim();
      const photoDate = String(row['拍照随访日期'] || row['photoDate'] || row['拍照随访'] || '').trim();

      if (!name) {
        results.failed++;
        results.errors.push(`第${rowNum}行：缺少姓名`);
        continue;
      }

      // 解析日期函数（支持 YYYY-MM-DD 或 YYYY.MM.DD 或 Excel 日期序列号）
      const parseDate = (dateStr: string): string | null => {
        if (!dateStr) return null;
        const dateMatch = dateStr.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/);
        if (dateMatch) {
          return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
        const numDate = Number(dateStr);
        if (!isNaN(numDate) && numDate > 0) {
          const d = XLSX.SSF.parse_date_code(numDate);
          if (d) {
            return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          }
        }
        return null;
      };

      const parsedFirstDate = parseDate(firstDate);
      if (!parsedFirstDate) {
        results.failed++;
        results.errors.push(`第${rowNum}行(${name})：缺少首次治疗日期或日期格式错误`);
        continue;
      }

      const parsedSecondDate = parseDate(secondDate);
      const parsedThirdDate = parseDate(thirdDate);
      const parsedPhotoDate = parseDate(photoDate);

      try {
        // 创建患者
        const { data: patient, error: patientError } = await client
          .from('patients')
          .insert({ name, phone, gender, age: isNaN(age) ? 0 : age, notes })
          .select()
          .single();
        if (patientError) throw new Error(patientError.message);

        // 收集所有已完成的日期
        const completedDates: { step_number: number; step_type: string; scheduled_date: string; completed_date: string }[] = [];
        completedDates.push({ step_number: 1, step_type: 'treatment_1', scheduled_date: parsedFirstDate, completed_date: parsedFirstDate });
        if (parsedSecondDate) {
          completedDates.push({ step_number: 2, step_type: 'treatment_2', scheduled_date: parsedSecondDate, completed_date: parsedSecondDate });
        }
        if (parsedThirdDate) {
          completedDates.push({ step_number: 3, step_type: 'treatment_3', scheduled_date: parsedThirdDate, completed_date: parsedThirdDate });
        }
        if (parsedPhotoDate) {
          completedDates.push({ step_number: 4, step_type: 'photo', scheduled_date: parsedPhotoDate, completed_date: parsedPhotoDate });
        }

        // 找到最后完成的日期
        const lastCompletedDate = completedDates[completedDates.length - 1].completed_date;
        const allCompleted = completedDates.length >= 4;

        // 生成步骤
        const stepsToInsert: { patient_id: number; step_number: number; step_type: string; scheduled_date: string; completed_date?: string }[] = [];

        // 添加已完成的步骤
        for (const cd of completedDates) {
          stepsToInsert.push({
            patient_id: patient.id,
            step_number: cd.step_number,
            step_type: cd.step_type,
            scheduled_date: cd.scheduled_date,
            completed_date: cd.completed_date,
          });
        }

        // 如果4次都完成，创建新一轮随访
        if (allCompleted) {
          const newCycleDates = generateStepDates(lastCompletedDate);
          for (const s of newCycleDates) {
            stepsToInsert.push({
              patient_id: patient.id,
              step_number: s.step_number,
              step_type: s.step_type,
              scheduled_date: s.scheduled_date,
            });
          }
        } else {
          // 根据最后完成的日期推算后续步骤
          const lastStepNumber = completedDates[completedDates.length - 1].step_number;
          const remainingSteps = generateStepDates(lastCompletedDate).filter(s => s.step_number > lastStepNumber);
          for (const s of remainingSteps) {
            stepsToInsert.push({
              patient_id: patient.id,
              step_number: s.step_number,
              step_type: s.step_type,
              scheduled_date: s.scheduled_date,
            });
          }
        }

        const { error: stepsError } = await client.from('followup_steps').insert(stepsToInsert);
        if (stepsError) throw new Error(stepsError.message);

        results.success++;
      } catch (dbErr) {
        results.failed++;
        results.errors.push(`第${rowNum}行(${name})：${dbErr instanceof Error ? dbErr.message : '数据库错误'}`);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error importing patients:', err);
    res.status(500).json({ error: '导入失败' });
  }
});

// GET /api/v1/patients/:id - 获取单个患者详情
router.get('/:id', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { id } = req.params;
    const { data: patient, error: patientError } = await client
      .from('patients').select('*').eq('id', parseInt(id)).maybeSingle();
    if (patientError) throw new Error(`查询失败: ${patientError.message}`);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const { data: steps, error: stepsError } = await client
      .from('followup_steps').select('*').eq('patient_id', parseInt(id))
      .order('step_number', { ascending: true });
    if (stepsError) throw new Error(`查询步骤失败: ${stepsError.message}`);
    res.json({ ...patient, steps: steps || [] });
  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// POST /api/v1/patients - 创建患者
router.post('/', async (req, res) => {
  const { name, phone, gender, age, notes, firstTreatmentDate, treatment2Date, treatment3Date, photoDate } = req.body;
  if (!name || !firstTreatmentDate) {
    return res.status(400).json({ error: 'Name and firstTreatmentDate are required' });
  }

  // 规范化日期格式（将 . 替换为 -）
  const normalizeDate = (d: string) => d.replace(/\./g, '-');
  const normalizedFirstDate = normalizeDate(firstTreatmentDate);
  const normalizedT2Date = treatment2Date ? normalizeDate(treatment2Date) : undefined;
  const normalizedT3Date = treatment3Date ? normalizeDate(treatment3Date) : undefined;
  const normalizedPhotoDate = photoDate ? normalizeDate(photoDate) : undefined;

  try {
    const client = getSupabaseClient();
    const { data: patient, error: patientError } = await client
      .from('patients').insert({ name, phone: phone || '', gender: gender || '', age: age || 0, notes: notes || '' })
      .select().single();
    if (patientError) throw new Error(`创建患者失败: ${patientError.message}`);

    // 生成4个步骤的计划日期
    const stepDates = generateStepDates(normalizedFirstDate);
    const today = getTodayBJ();

    // 标记已提供日期的步骤为已完成
    const completedDates: Record<number, string> = {};
    completedDates[1] = normalizedFirstDate; // 第一次治疗始终标记为已完成
    if (normalizedT2Date) completedDates[2] = normalizedT2Date;
    if (normalizedT3Date) completedDates[3] = normalizedT3Date;
    if (normalizedPhotoDate) completedDates[4] = normalizedPhotoDate;

    const stepsToInsert = stepDates.map(s => ({
      patient_id: patient.id,
      step_number: s.step_number,
      step_type: s.step_type,
      scheduled_date: s.scheduled_date,
      completed_date: completedDates[s.step_number] || null,
    }));

    const { error: stepsError } = await client.from('followup_steps').insert(stepsToInsert);
    if (stepsError) throw new Error(`创建步骤失败: ${stepsError.message}`);

    // 如果有已完成的步骤，根据最后一个完成日期推算并创建下一次随诊
    const completedStepNumbers = Object.keys(completedDates).map(Number).sort((a, b) => a - b);
    if (completedStepNumbers.length > 0 && completedStepNumbers.length < 4) {
      // 找到最后一个完成的步骤
      const lastCompletedStepNum = completedStepNumbers[completedStepNumbers.length - 1];
      const lastCompletedDate = completedDates[lastCompletedStepNum];
      const lastCompletedBase = parseDateBJ(lastCompletedDate);

      // 计算需要创建的后续步骤
      const newSteps = [];
      for (let i = lastCompletedStepNum + 1; i <= 4; i++) {
        const d = new Date(lastCompletedBase);
        d.setDate(lastCompletedBase.getDate() + (i - lastCompletedStepNum) * STEP_INTERVAL_DAYS);
        newSteps.push({
          patient_id: patient.id,
          step_number: i,
          step_type: STEP_TYPES[i - 1],
          scheduled_date: formatDateBJ(d),
        });
      }

      if (newSteps.length > 0) {
        // 删除之前自动生成的步骤，替换为基于实际完成日期推算的步骤
        await client.from('followup_steps').delete()
          .eq('patient_id', patient.id)
          .gt('step_number', lastCompletedStepNum);
        const { error: newStepsError } = await client.from('followup_steps').insert(newSteps);
        if (newStepsError) throw new Error(`创建后续步骤失败: ${newStepsError.message}`);
      }
    } else if (completedStepNumbers.length === 4) {
      // 所有步骤都已完成，创建新的随访周期（从第5步开始）
      const lastCompletedDate = completedDates[4];
      const lastCompletedBase = parseDateBJ(lastCompletedDate);
      const newSteps = STEP_TYPES.map((stepType, i) => {
        const d = new Date(lastCompletedBase);
        d.setDate(lastCompletedBase.getDate() + (i + 1) * STEP_INTERVAL_DAYS);
        return {
          patient_id: patient.id,
          step_number: 5 + i,
          step_type: stepType,
          scheduled_date: formatDateBJ(d),
        };
      });
      const { error: newStepsError } = await client.from('followup_steps').insert(newSteps);
      if (newStepsError) throw new Error(`创建新周期步骤失败: ${newStepsError.message}`);
    }

    const { data: steps } = await client.from('followup_steps').select('*')
      .eq('patient_id', patient.id).order('step_number', { ascending: true });
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
      .from('patients').update(updateData).eq('id', parseInt(id)).select().single();
    if (error) throw new Error(`更新失败: ${error.message}`);
    res.json(patient);
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// DELETE /api/v1/patients/:id - 删除患者
router.delete('/:id', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { id } = req.params;
    const { error: stepsError } = await client.from('followup_steps').delete().eq('patient_id', parseInt(id));
    if (stepsError) throw new Error(`删除步骤失败: ${stepsError.message}`);
    const { data: patient, error: patientError } = await client
      .from('patients').delete().eq('id', parseInt(id)).select().single();
    if (patientError) throw new Error(`删除患者失败: ${patientError.message}`);
    res.json({ message: 'Patient deleted', patient });
  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

// PUT /api/v1/patients/:patientId/steps/:stepId - 更新随访步骤（完成时自动调整后续步骤）
router.put('/:patientId/steps/:stepId', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { patientId, stepId } = req.params;
    const { completed_date, scheduled_date, notes } = req.body;

    // 先更新当前步骤
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (completed_date !== undefined) updateData.completed_date = completed_date;
    if (scheduled_date !== undefined) updateData.scheduled_date = scheduled_date;
    if (notes !== undefined) updateData.notes = notes;

    const { data: step, error } = await client
      .from('followup_steps').update(updateData).eq('id', parseInt(stepId)).select().single();
    if (error) throw new Error(`更新步骤失败: ${error.message}`);

    // 如果标记完成且完成日期与计划日期不同，自动调整后续步骤
    if (completed_date && step) {
      const currentStep = step;
      const plannedDate = parseDateBJ(currentStep.scheduled_date);
      const actualDate = parseDateBJ(completed_date);
      const diffDays = Math.round((actualDate.getTime() - plannedDate.getTime()) / 86400000);

      if (diffDays !== 0) {
        // 获取后续未完成的步骤
        const { data: laterSteps, error: laterError } = await client
          .from('followup_steps')
          .select('*')
          .eq('patient_id', parseInt(patientId))
          .gt('step_number', currentStep.step_number)
          .is('completed_date', null)
          .order('step_number', { ascending: true });
        if (laterError) throw new Error(`查询后续步骤失败: ${laterError.message}`);

        // 调整后续步骤的计划日期
        if (laterSteps && laterSteps.length > 0) {
          for (const laterStep of laterSteps) {
            const oldDate = parseDateBJ(laterStep.scheduled_date);
            const newDate = new Date(oldDate.getTime() + diffDays * 86400000);
            await client
              .from('followup_steps')
              .update({ scheduled_date: formatDateBJ(newDate), updated_at: new Date().toISOString() })
              .eq('id', laterStep.id);
          }
        }
      }
    }

    // 返回更新后的完整步骤列表
    const { data: allSteps } = await client
      .from('followup_steps').select('*').eq('patient_id', parseInt(patientId))
      .order('step_number', { ascending: true });

    res.json({ step, allSteps: allSteps || [] });
  } catch (err) {
    console.error('Error updating step:', err);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

export default router;
