// Mistake Analyzer — classify wrong answers into error types.
// Never invents a cause: without enough evidence returns 'unknown'.

const ERROR_TYPES = [
  'conceptual',
  'calculation',
  'unit_error',
  'formula_selection',
  'reading_error',
  'graph_error',
  'sign_direction',
  'algebra_error',
  'random_mistake',
  'unknown'
];

const TYPE_LABELS = {
  conceptual: 'سوء فهم للمفهوم',
  calculation: 'خطأ حسابي',
  unit_error: 'خطأ في الوحدات',
  formula_selection: 'خطأ في اختيار القانون',
  reading_error: 'خطأ في قراءة المعطيات',
  graph_error: 'خطأ في قراءة المنحنى',
  sign_direction: 'خطأ في الإشارة/الاتجاه',
  algebra_error: 'خطأ جبري',
  random_mistake: 'خطأ عشوائي',
  unknown: 'غير محدد'
};

const TYPE_MISCONCEPTION_HINTS = {
  conceptual: 'يظهر عندما يختار الطالب خيارًا يعكس فكرة خاطئة شائعة (مذكور في common_misconception)',
  calculation: 'يظهر عندما تكون طريقة السؤال صحيحة والخطأ في الحساب العددي',
  unit_error: 'يظهر عندما يكون السؤال به تحويل وحدات قبل التعويض',
  formula_selection: 'يرتبط بسؤال مهارة اختيار القانون المناسب',
  graph_error: 'يرتبط بأسئلة قراءة المنحنيات',
  sign_direction: 'يرتبط بأسئلة الإشارة والاتجاه'
};

// Determine error type from question metadata + chosen option + correctness.
// question: { skill_id, type, common_misconception? }
// Returns best-guess error type. 'unknown' when evidence is insufficient.
function classifyError(question, selectedIndex, correctIndex) {
  if (selectedIndex === correctIndex) return { error_type: null, reason: 'correct' };

  const q = question || {};
  const skill = q.skill_id || '';
  const qType = q.type || '';

  // Strong signals from question/skill type.
  if (skill === 'mat-unitconv' || qType === 'unit_error') {
    return { error_type: 'unit_error', reason: 'سؤال تحويل وحدات' };
  }
  if (skill === 'dom-formula_choice' || qType === 'formula_selection') {
    return { error_type: 'formula_selection', reason: 'سؤال اختيار قانون' };
  }
  if (skill === 'dom-graph_x_t' || skill === 'dom-graph_v_t' || qType === 'graph' || qType === 'graph_error') {
    return { error_type: 'graph_error', reason: 'سؤال قراءة منحنى' };
  }
  if (skill === 'dom-sign_interpret' || qType === 'sign_direction') {
    return { error_type: 'sign_direction', reason: 'سؤال إشارة/اتجاه' };
  }
  if (qType === 'conceptual') {
    return { error_type: 'conceptual', reason: 'سؤال مفاهيمي' };
  }
  if (qType === 'calculation') {
    return { error_type: 'calculation', reason: 'سؤال حسابي' };
  }

  // Positional heuristic: choosing the option marked as a common misconception.
  if (q.common_misconception && selectedIndex !== null) {
    return { error_type: 'conceptual', reason: 'اختيار خيار يعكس فكرة خاطئة شائعة' };
  }

  return { error_type: 'unknown', reason: 'دليل غير كافٍ لتحديد سبب الخطأ بدقة' };
}

// After enough wrong answers on the same skill, build a confident weakness.
function buildWeaknessReport(skillId, wrongCount, totalAttempts, mastery, confidence) {
  const evidenceLevel =
    totalAttempts >= 5 && wrongCount / totalAttempts >= 2 / 3
      ? 'High'
      : totalAttempts >= 3 && wrongCount / totalAttempts >= 0.5
        ? 'Medium'
        : 'Low';

  const recommendedAction =
    mastery < 40
      ? 'مراجعة المفهوم الأساسي المسبق + سؤالان سهلان + سؤالان متوسطان'
      : mastery < 60
        ? 'مراجعة قصيرة + أمثلة إضافية + أسئلة متوسطة'
        : 'أمثلة إضافية اختيارية';

  return {
    weak_skill: skillId,
    evidence: `${wrongCount} wrong / ${totalAttempts} attempts`,
    confidence: evidenceLevel,
    recommended_action: recommendedAction
  };
}

function isValidErrorType(t) {
  return ERROR_TYPES.includes(t);
}

module.exports = {
  classifyError,
  buildWeaknessReport,
  TYPE_LABELS,
  ERROR_TYPES,
  isValidErrorType
};