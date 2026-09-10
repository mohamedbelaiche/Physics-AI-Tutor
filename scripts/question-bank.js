// ============================================================
// Diagnostic question bank — اختبار تحديد مستوى طلاب البكالوريا
// فيزياء (مناهج البكالوريا: ميكانيك، كهرباء، نووي، توازن كيميائي،
// متابعة زمنية لتحول كيميائي)
//
// This file is the SINGLE SOURCE OF TRUTH for the question bank.
// It is used by scripts/build-diagnostic-seed.js to generate the SQL
// migration that seeds Supabase. The answers NEVER reach the client:
// grading happens inside a SECURITY DEFINER database function.
//
// Skills: math, units, concepts, data, problem_solving, methodology
// Difficulty levels: 1 أساسي, 2 متوسط, 3 متقدم, 4 تحدي
//
// diagnostic_tags describe the plausible misconception an option
// represents or the knowledge dimension being measured, so the system
// can later detect repeated error patterns.
// ============================================================

module.exports = {
  test: {
    id: 'bac-physics-v1',
    title: 'اختبار تحديد المستوى في الفيزياء',
    description:
      'اختبار تشخيصي من 40 سؤالاً لطلاب البكالوريا في الفيزياء. يقيس المهارات الأساسية: الرياضيات، الوحدات والرموز، المفاهيم الفيزيائية، قراءة البيانات، حل المسائل، والمنهجية.',
    subject: 'physics',
    grade: 'baccalaureate',
    version: 1,
    question_bank_version: '2024-09-v1',
    total_questions: 40,
    time_limit_minutes: 60
  },

  questions: [
    // ===================== SKILL: math (8) =====================
    {
      id: 'PHY-DIAG-001',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: null,
      sub_skill: 'scientific_notation',
      difficulty: 1,
      question: 'أكتب العدد 0.00052 بالكتابة العلمية.',
      options: [
        { id: 'A', text: '5.2 × 10⁻⁴', diagnostic_tag: null },
        { id: 'B', text: '5.2 × 10⁴', diagnostic_tag: 'decimal_direction_error' },
        { id: 'C', text: '52 × 10⁻⁵', diagnostic_tag: 'not_scientific_form' },
        { id: 'D', text: '0.52 × 10⁻³', diagnostic_tag: 'not_scientific_form' }
      ],
      correct: 'A',
      explanation:
        'لتحويل 0.00052 إلى كتابة علمية نحرك الفاصلة 4 خانات نحو اليمين فينتج الأس ‎-4: 5.2 × 10⁻⁴.',
      diagnostic_tags: ['scientific_notation', 'power_of_ten', 'decimal_point_movement'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-007',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: null,
      sub_skill: 'powers_of_ten',
      difficulty: 2,
      question: 'احسب:  (2 × 10³) × (3 × 10⁻²)',
      options: [
        { id: 'A', text: '60', diagnostic_tag: null },
        { id: 'B', text: '0.6', diagnostic_tag: 'exponent_multiplication_error' },
        { id: 'C', text: '6', diagnostic_tag: 'forgotten_ten_factor' },
        { id: 'D', text: '600', diagnostic_tag: 'exponent_sign_error' }
      ],
      correct: 'A',
      explanation:
        'نضرب الأعداد (2×3=6) ونجمع الأسس: 10^(3-2)=10¹، فينتج 6 × 10¹ = 60.',
      diagnostic_tags: ['powers_of_ten', 'exponent_addition', 'multiplication'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-013',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: null,
      sub_skill: 'rearranging_formula',
      difficulty: 2,
      question: 'من العلاقة  F = m × a  ، أعزل التسارع a:',
      options: [
        { id: 'A', text: 'a = F / m', diagnostic_tag: null },
        { id: 'B', text: 'a = F × m', diagnostic_tag: 'moved_side_as_multiplication' },
        { id: 'C', text: 'a = m / F', diagnostic_tag: 'inverted_fraction' },
        { id: 'D', text: 'a = F − m', diagnostic_tag: 'subtraction_misconception' }
      ],
      correct: 'A',
      explanation:
        'لإيجاد a نقسم طرفي المعادلة على m: a = F/m.',
      diagnostic_tags: ['rearrange_formula', 'isolate_variable', 'algebra'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-018',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: 'problem_solving',
      sub_skill: 'square_root_and_estimate',
      difficulty: 2,
      question:
        'في العلاقة الدورية لنواس بسيط  T = 2π√(L/g) ، إذا كان L = 1 m  و g = 10 m/s² ، فما القيمة التقريبية لـ T (باستعمال 2π ≈ 6.3)؟',
      options: [
        { id: 'A', text: '≈ 2.0 s', diagnostic_tag: null },
        { id: 'B', text: '≈ 0.63 s', diagnostic_tag: 'forgot_square_root' },
        { id: 'C', text: '≈ 6.3 s', diagnostic_tag: 'root_of_whole_ratio_error' },
        { id: 'D', text: '≈ 1.26 s', diagnostic_tag: 'root_of_numerator_only' }
      ],
      correct: 'A',
      explanation:
        '√(1/10) = √0.1 ≈ 0.316 وبالتالي T ≈ 6.3 × 0.316 ≈ 2.0 s.',
      diagnostic_tags: ['square_root', 'estimate', 'calculation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-023',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: 'concepts',
      sub_skill: 'proportionality',
      difficulty: 2,
      question:
        'في موصل أومي مقاومته R ثابتة، إذا تضاعف التيار المار فيه، فإن التوتر بين طرفيه:',
      options: [
        { id: 'A', text: 'يتضاعف', diagnostic_tag: null },
        { id: 'B', text: 'ينقص إلى النصف', diagnostic_tag: 'inverse_relation_error' },
        { id: 'C', text: 'يبقى ثابتاً', diagnostic_tag: 'linearity_unknown' },
        { id: 'D', text: 'يصبح معدومًا', diagnostic_tag: 'voltage_elimination_error' }
      ],
      correct: 'A',
      explanation:
        'من قانون أوم U = R × I، مع R ثابتة فإن U تتناسب طردًا مع I: إذا تضاعف التيار تضاعف التوتر.',
      diagnostic_tags: ['proportionality', 'direct_relation', 'ohm_law'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-028',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: null,
      sub_skill: 'scientific_notation_division',
      difficulty: 3,
      question: 'احسب:   (8 × 10⁶) ÷ (4 × 10⁻²)',
      options: [
        { id: 'A', text: '2 × 10⁸', diagnostic_tag: null },
        { id: 'B', text: '2 × 10⁴', diagnostic_tag: 'exponents_added_not_subtracted' },
        { id: 'C', text: '2 × 10³', diagnostic_tag: 'division_of_exponents' },
        { id: 'D', text: '2 × 10⁻⁸', diagnostic_tag: 'sign_error_in_exponents' }
      ],
      correct: 'A',
      explanation:
        '8 ÷ 4 = 2 وللقسمة نطرح الأسس: 10^(6-(-2)) = 10⁸، أي 2 × 10⁸.',
      diagnostic_tags: ['division', 'exponent_subtraction', 'scientific_notation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-033',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: 'concepts',
      sub_skill: 'percentage_calculation',
      difficulty: 1,
      question:
        'في تحول كيميائي، تحول %25 من الكمية الابتدائية البالغة 80 mol لمادة ما. كم مول تحول فعليًا؟',
      options: [
        { id: 'A', text: '20 mol', diagnostic_tag: null },
        { id: 'B', text: '25 mol', diagnostic_tag: 'percentage_number_confusion' },
        { id: 'C', text: '55 mol', diagnostic_tag: 'remaining_amount_error' },
        { id: 'D', text: '200 mol', diagnostic_tag: 'multiplication_by_percent_error' }
      ],
      correct: 'A',
      explanation: '25% من 80 = (25/100) × 80 = 20 mol.',
      diagnostic_tags: ['percentage', 'proportion', 'calculation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-039',
      skill: 'math',
      primary_skill: 'math',
      secondary_skill: null,
      sub_skill: 'solving_equation',
      difficulty: 3,
      question: 'حل المعادلة  2t² − 8 = 0  علماً أن t > 0:',
      options: [
        { id: 'A', text: 't = 2', diagnostic_tag: null },
        { id: 'B', text: 't = 4', diagnostic_tag: 'missing_square_root' },
        { id: 'C', text: 't = 16', diagnostic_tag: 'squared_value_kept' },
        { id: 'D', text: 't = ±2', diagnostic_tag: 'negative_root_ignored_condition' }
      ],
      correct: 'A',
      explanation:
        '2t² = 8 إذن t² = 4 وبما أن t>0 فإن t = +2.',
      diagnostic_tags: ['quadratic', 'solve_equation', 'positive_root'],
      weight: 1
    },

    // ===================== SKILL: units (6) =====================
    {
      id: 'PHY-DIAG-002',
      skill: 'units',
      primary_skill: 'units',
      secondary_skill: null,
      sub_skill: 'speed_conversion',
      difficulty: 1,
      question: 'جسم يتحرك بسرعة 72 km/h. ما سرعته بوحدة m/s؟',
      options: [
        { id: 'A', text: '20 m/s', diagnostic_tag: null },
        { id: 'B', text: '259.2 m/s', diagnostic_tag: 'conversion_multiplication_error' },
        { id: 'C', text: '10 m/s', diagnostic_tag: 'halved_value_error' },
        { id: 'D', text: '72 m/s', diagnostic_tag: 'unit_not_converted' }
      ],
      correct: 'A',
      explanation: 'لتحويل km/h إلى m/s نقسم على 3.6: 72 ÷ 3.6 = 20 m/s.',
      diagnostic_tags: ['speed_conversion', 'division_by_3_6', 'unit_not_converted'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-008',
      skill: 'units',
      primary_skill: 'units',
      secondary_skill: 'math',
      sub_skill: 'prefix_conversion',
      difficulty: 1,
      question: 'ما قيمة 2500 μm بوحدة mm؟',
      options: [
        { id: 'A', text: '2.5 mm', diagnostic_tag: null },
        { id: 'B', text: '25 mm', diagnostic_tag: 'factor_ten_error' },
        { id: 'C', text: '0.25 mm', diagnostic_tag: 'factor_ten_opposite' },
        { id: 'D', text: '250 mm', diagnostic_tag: 'prefix_ignored' }
      ],
      correct: 'A',
      explanation:
        '1 μm = 10⁻⁶ m و 1 mm = 10⁻³ m، فالعلاقة 1 mm = 1000 μm، إذن 2500 μm = 2.5 mm.',
      diagnostic_tags: ['prefix_conversion', 'micro_to_milli', 'powers_of_ten'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-014',
      skill: 'units',
      primary_skill: 'units',
      secondary_skill: null,
      sub_skill: 'volume_conversion',
      difficulty: 2,
      question: 'ما قيمة 250 cm³ بوحدة اللتر (L)؟',
      options: [
        { id: 'A', text: '0.25 L', diagnostic_tag: null },
        { id: 'B', text: '2.5 L', diagnostic_tag: 'factor_ten_error' },
        { id: 'C', text: '25 L', diagnostic_tag: 'factor_hundred_error' },
        { id: 'D', text: '0.025 L', diagnostic_tag: 'opposite_factor_error' }
      ],
      correct: 'A',
      explanation: '1 L = 1 dm³ = 1000 cm³، إذن 250 cm³ = 0.25 L.',
      diagnostic_tags: ['volume_conversion', 'liter', 'cubic_centimeter'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-019',
      skill: 'units',
      primary_skill: 'units',
      secondary_skill: 'concepts',
      sub_skill: 'si_activity_unit',
      difficulty: 2,
      question: 'ما وحدة قياس النشاط الإشعاعي في النظام الدولي SI؟',
      options: [
        { id: 'A', text: 'البيكريل (Bq)', diagnostic_tag: null },
        { id: 'B', text: 'الجول (J)', diagnostic_tag: 'energy_unit_confusion' },
        { id: 'C', text: 'الواط (W)', diagnostic_tag: 'power_unit_confusion' },
        { id: 'D', text: 'الهيرتز (Hz)', diagnostic_tag: 'frequency_unit_confusion' }
      ],
      correct: 'A',
      explanation:
        'النشاط الإشعاعي هو عدد التفككات في الثانية ويقاس بالبيكريل Bq.',
      diagnostic_tags: ['si_units', 'activity', 'becquerel'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-021',
      skill: 'units',
      primary_skill: 'units',
      secondary_skill: 'concepts',
      sub_skill: 'rate_constant_unit',
      difficulty: 3,
      question:
        'في تفاعل من الرتبة 1، تُعطى سرعة التفاعل بالعلاقة  v = k × [A] . ما وحدة ثابتة السرعة k في النظام الدولي؟',
      options: [
        { id: 'A', text: 's⁻¹', diagnostic_tag: null },
        { id: 'B', text: 'mol·L⁻¹·s⁻¹', diagnostic_tag: 'unit_of_velocity_mistaken' },
        { id: 'C', text: 'L·mol⁻¹·s⁻¹', diagnostic_tag: 'second_order_constant' },
        { id: 'D', text: 'mol·L⁻¹', diagnostic_tag: 'concentration_unit_mistaken' }
      ],
      correct: 'A',
      explanation:
        'v بوحدة mol·L⁻¹·s⁻¹ و[A] بوحدة mol·L⁻¹، إذن k = v/[A] وهو بوحدة s⁻¹.',
      diagnostic_tags: ['rate_constant_unit', 'reaction_order', 'dimensional_analysis'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-029',
      skill: 'units',
      primary_skill: 'units',
      secondary_skill: 'math',
      sub_skill: 'dimensions',
      difficulty: 3,
      question:
        'ما وحدة المقاومة الكهربائية (الأوم Ω) بدلالة وحدات النظام الدولي الأساسية؟',
      options: [
        { id: 'A', text: 'kg·m²·s⁻³·A⁻²', diagnostic_tag: null },
        { id: 'B', text: 'kg·m²·s⁻²·A⁻¹', diagnostic_tag: 'energy_unit_confusion' },
        { id: 'C', text: 'kg·m·s⁻²', diagnostic_tag: 'newton_unit_confusion' },
        { id: 'D', text: 'kg·m·s⁻¹', diagnostic_tag: 'momentum_unit_confusion' }
      ],
      correct: 'A',
      explanation:
        'R = U/I، حيث U = J/C …، وبالحساب البعدي يكون الأوم = kg·m²·s⁻³·A⁻².',
      diagnostic_tags: ['dimensions', 'si_base_units', 'resistance'],
      weight: 1
    },

    // ===================== SKILL: concepts (8) =====================
    {
      id: 'PHY-DIAG-003',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: null,
      sub_skill: 'speed_vs_velocity',
      difficulty: 1,
      question: 'أي عبارة صحيحة حول السرعة المتوسطة؟',
      options: [
        { id: 'A', text: 'هي المسافة المقطوعة مقسومة على مدة القطع', diagnostic_tag: null },
        { id: 'B', text: 'هي تغير الموضع مقسومًا على المدة', diagnostic_tag: 'vector_velocity_misconception' },
        { id: 'C', text: 'تساوي دائمًا السرعة اللحظية', diagnostic_tag: 'average_vs_instantaneous' },
        { id: 'D', text: 'لا تعتمد على المسار المقطوع', diagnostic_tag: 'path_dependence_error' }
      ],
      correct: 'A',
      explanation:
        'السرعة المتوسطة كمية قياسية: المسافة ÷ المدة. أما تغير الموضع ÷ المدة فهو السرعة المتجهة المتوسطة.',
      diagnostic_tags: ['average_speed', 'scalar_vs_vector', 'path_dependence'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-009',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: null,
      sub_skill: 'newton_first_law',
      difficulty: 2,
      question:
        'جسم يتحرك بسرعة ثابتة في خط مستقيم. أي استنتاج صحيح؟',
      options: [
        { id: 'A', text: 'محصلة القوى المطبقة عليه معدومة', diagnostic_tag: null },
        { id: 'B', text: 'توجد بالضرورة قوة في اتجاه الحركة', diagnostic_tag: 'motion_requires_force' },
        { id: 'C', text: 'لا توجد أي قوة مطبقة على الجسم', diagnostic_tag: 'no_forces_at_all' },
        { id: 'D', text: 'محصلة القوى تتناسب مع السرعة', diagnostic_tag: 'force_proportional_to_velocity' }
      ],
      correct: 'A',
      explanation:
        'قانون نيوتن الأول: الحركة المستقيمة المنتظمة تعني انعدام محصلة القوى، وليس انعدام القوى كلها.',
      diagnostic_tags: ['newton_first_law', 'resultant_force', 'uniform_motion'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-015',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: 'units',
      sub_skill: 'mass_vs_weight',
      difficulty: 2,
      question:
        'رائد فضاء يعمل على سطح القمر حيث الجاذبية تساوي سدس جاذبية الأرض. أي كمية تتغير نتيجة ذلك؟',
      options: [
        { id: 'A', text: 'وزنه فقط', diagnostic_tag: null },
        { id: 'B', text: 'كتلته فقط', diagnostic_tag: 'mass_changes_misconception' },
        { id: 'C', text: 'وزنه وكتلته معًا', diagnostic_tag: 'both_change_misconception' },
        { id: 'D', text: 'لا تتغير أي كمية', diagnostic_tag: 'nothing_changes_misconception' }
      ],
      correct: 'A',
      explanation:
        'الكتلة كمية مستقلة عن الجاذبية، أما الوزن P = m×g فيتغير بتغير g.',
      diagnostic_tags: ['mass_vs_weight', 'gravity_dependence', 'weight_formula'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-020',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: null,
      sub_skill: 'action_reaction',
      difficulty: 2,
      question:
        'عندما يدفع شخص حائطًا بقوة، يندفع الشخص إلى الخلف. أي قانون يفسر هذه الظاهرة؟',
      options: [
        { id: 'A', text: 'قانون الفعل ورد الفعل (نيوتن الثالث)', diagnostic_tag: null },
        { id: 'B', text: 'قانون القصور الذاتي', diagnostic_tag: 'first_law_misapplied' },
        { id: 'C', text: 'قانون نيوتن الثاني', diagnostic_tag: 'second_law_misapplied' },
        { id: 'D', text: 'قانون حفظ الكمية الحركة', diagnostic_tag: 'momentum_law_misapplied' }
      ],
      correct: 'A',
      explanation:
        'الحائط يطبق على الشخص قوة رد فعل مساوية في المقدار ومعاكسة في الاتجاه (نيوتن الثالث).',
      diagnostic_tags: ['newton_third_law', 'action_reaction', 'force_pairs'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-024',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: null,
      sub_skill: 'equilibrium_constant_meaning',
      difficulty: 3,
      question:
        'عند درجة حرارة ثابتة، ثابت التوازن K لجملة كيميائية في حالة التوازن:',
      options: [
        { id: 'A', text: 'لا يعتمد على التركيزات الابتدائية', diagnostic_tag: null },
        { id: 'B', text: 'يتغير عند إضافة كمية من متفاعل', diagnostic_tag: 'conc_change_misconception' },
        { id: 'C', text: 'يتغير عند إزالة ناتج من الوسط', diagnostic_tag: 'product_removal_misconception' },
        { id: 'D', text: 'يتغير عند تغيير الحجم', diagnostic_tag: 'volume_change_misconception' }
      ],
      correct: 'A',
      explanation:
        'ثابت التوازن يعتمد على درجة الحرارة فقط، ويبقى ثابتًا عند تغيير التركيزات أو الحجم عند نفس الحرارة.',
      diagnostic_tags: ['equilibrium_constant', 'temperature_dependence', 'le_chatelier_basics'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-030',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: 'math',
      sub_skill: 'current_voltage_relation',
      difficulty: 2,
      question:
        'في دارة تتكون من مولّد وناقل أومي، إذا زاد التوتر المطبق بين طرفي الناقل دون تغيير مقاومته، فإن شدة التيار:',
      options: [
        { id: 'A', text: 'تزداد بنفس النسبة تقريبًا', diagnostic_tag: null },
        { id: 'B', text: 'تتناقص', diagnostic_tag: 'inverse_relation_error' },
        { id: 'C', text: 'لا تتغير', diagnostic_tag: 'resistance_only_perception' },
        { id: 'D', text: 'تنعدم', diagnostic_tag: 'current_elimination_error' }
      ],
      correct: 'A',
      explanation:
        'من قانون أوم I = U/R: عند ثبات R يزداد التيار طردًا مع التوتر.',
      diagnostic_tags: ['ohm_law', 'current_voltage_relation', 'direct_proportionality'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-034',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: null,
      sub_skill: 'relative_motion',
      difficulty: 3,
      question:
        'راكب يجلس بثبات داخل قطار يتحرك بسرعة ثابتة في خط مستقيم. بالنسبة لراكب آخر يجلس في نفس القطار، فإن الراكب الأول:',
      options: [
        { id: 'A', text: 'ساكن (حركته معدومة)', diagnostic_tag: null },
        { id: 'B', text: 'يتحرك بنفس سرعة القطار', diagnostic_tag: 'reference_frame_error' },
        { id: 'C', text: 'يتحرك بسرعة مضاعفة', diagnostic_tag: 'double_speed_error' },
        { id: 'D', text: 'يتحرك بعكس اتجاه القطار', diagnostic_tag: 'opposite_direction_error' }
      ],
      correct: 'A',
      explanation:
        'الحركة نسبية: الراكبان في نفس المعلم (القطار)، فالراكب الأول ساكن بالنسبة للثاني.',
      diagnostic_tags: ['relative_motion', 'frame_of_reference', 'repos_perception'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-037',
      skill: 'concepts',
      primary_skill: 'concepts',
      secondary_skill: null,
      sub_skill: 'energy_transformation',
      difficulty: 2,
      question:
        'عند سقوط حجر من ارتفاع معين (مع إهمال مقاومة الهواء)، تتحول طاقته الكامنة الثقالية إلى:',
      options: [
        { id: 'A', text: 'طاقة حركية', diagnostic_tag: null },
        { id: 'B', text: 'طاقة كيميائية', diagnostic_tag: 'chemical_energy_error' },
        { id: 'C', text: 'طاقة نووية', diagnostic_tag: 'nuclear_energy_error' },
        { id: 'D', text: 'تبقى كامنة دون تغيير', diagnostic_tag: 'no_transformation_error' }
      ],
      correct: 'A',
      explanation:
        'أثناء السقوط تنخفض الطاقة الكامنة وتزداد الطاقة الحركية بنفس المقدار (حفظ الطاقة الميكانيكية).',
      diagnostic_tags: ['energy_transformation', 'potential_to_kinetic', 'energy_conservation'],
      weight: 1
    },

    // ===================== SKILL: data (6) =====================
    {
      id: 'PHY-DIAG-004',
      skill: 'data',
      primary_skill: 'data',
      secondary_skill: 'concepts',
      sub_skill: 'table_reading',
      difficulty: 1,
      question:
        'جدول يعطي موضع جسم في لحظات مختلفة: (0;0) ، (1;2) ، (2;4) ، (3;6) حيث الزمن بالثانية والموضع بالمتر. طبيعة هذه الحركة:',
      options: [
        { id: 'A', text: 'حركة مستقيمة منتظمة', diagnostic_tag: null },
        { id: 'B', text: 'حركة مستقيمة متسارعة بانتظام', diagnostic_tag: 'acceleration_misread' },
        { id: 'C', text: 'حركة مستقيمة متباطئة', diagnostic_tag: 'deceleration_misread' },
        { id: 'D', text: 'الحركة مستحيلة من هذه البيانات', diagnostic_tag: 'insufficient_data_error' }
      ],
      correct: 'A',
      explanation:
        'الإزاحة تزداد بمقدار ثابت (2 m) كل ثانية، أي السرعة ثابتة: الحركة منتظمة.',
      diagnostic_tags: ['table_reading', 'uniform_motion', 'constant_displacement'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-010',
      skill: 'data',
      primary_skill: 'data',
      secondary_skill: 'problem_solving',
      sub_skill: 'slope_reading',
      difficulty: 2,
      question:
        'منحنى v(t) لحركة جسم هو خط مستقيم يمر بالنقطتين (2; 6) و (6; 18) (الزمن بالثانية والسرعة بـ m/s). ما قيمة التسارع؟',
      options: [
        { id: 'A', text: '3 m/s²', diagnostic_tag: null },
        { id: 'B', text: '2 m/s²', diagnostic_tag: 'division_error' },
        { id: 'C', text: '12 m/s²', diagnostic_tag: 'denominator_omitted' },
        { id: 'D', text: '4 m/s²', diagnostic_tag: 'interval_sum_error' }
      ],
      correct: 'A',
      explanation:
        'التسارع = ميل المستقيم = (18-6)/(6-2) = 12/4 = 3 m/s².',
      diagnostic_tags: ['slope_reading', 'graph_interpretation', 'acceleration'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-016',
      skill: 'data',
      primary_skill: 'data',
      secondary_skill: 'concepts',
      sub_skill: 'x_t_slope_meaning',
      difficulty: 2,
      question:
        'من منحنى الموضع x(t) لحركة مستقيمة، ميل المماس للمنحنى عند لحظة معينة يمثل:',
      options: [
        { id: 'A', text: 'السرعة اللحظية', diagnostic_tag: null },
        { id: 'B', text: 'التسارع اللحظي', diagnostic_tag: 'slope_meaning_confusion' },
        { id: 'C', text: 'المسافة الكلية المقطوعة', diagnostic_tag: 'position_misread' },
        { id: 'D', text: 'الزمن المستغرق', diagnostic_tag: 'time_misread' }
      ],
      correct: 'A',
      explanation:
        'مشتقة الموضع بالنسبة للزمن dx/dt هي السرعة اللحظية، وهي ميل المماس لمنحنى x(t).',
      diagnostic_tags: ['x_t_graph', 'tangent_slope', 'instantaneous_velocity'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-025',
      skill: 'data',
      primary_skill: 'data',
      secondary_skill: 'math',
      sub_skill: 'extrapolation',
      difficulty: 3,
      question:
        'في تجربة تبريد، سجلت النقاط (0; 80) و (5; 60) لدرجة الحرارة (بالدرجة) مقابل الزمن (بالدقيقة)، والتناقص خطي تقريبًا. ما درجة الحرارة المتوقعة عند t = 10 min؟',
      options: [
        { id: 'A', text: '40 درجة', diagnostic_tag: null },
        { id: 'B', text: '20 درجة', diagnostic_tag: 'extrapolation_miscomputed' },
        { id: 'C', text: '30 درجة', diagnostic_tag: 'half_rate_error' },
        { id: 'D', text: '50 درجة', diagnostic_tag: 'rate_confusion' }
      ],
      correct: 'A',
      explanation:
        'الميل = (60-80)/5 = -4 درجة/دقيقة، عند t=10: 80 - 4×10 = 40 درجة.',
      diagnostic_tags: ['extrapolation', 'linear_model', 'table_reading'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-031',
      skill: 'data',
      primary_skill: 'data',
      secondary_skill: 'concepts',
      sub_skill: 'graph_shape_interpretation',
      difficulty: 3,
      question:
        'منحنى السرعة v(t) لحركة جسم هو خط مستقيم صاعد يمر بمبدأ المحورين. أي عبارة صحيحة؟',
      options: [
        { id: 'A', text: 'الحركة مستقيمة متسارعة بانتظام', diagnostic_tag: null },
        { id: 'B', text: 'الحركة مستقيمة منتظمة', diagnostic_tag: 'constant_slope_confusion' },
        { id: 'C', text: 'الجسم ساكن', diagnostic_tag: 'zero_motion_misread' },
        { id: 'D', text: 'الحركة متباطئة', diagnostic_tag: 'direction_of_slope_misread' }
      ],
      correct: 'A',
      explanation:
        'خط مستقيم صاعد يمر بالمبدأ يعني أن الميل (التسارع) ثابت موجب: حركة متسارعة بانتظام.',
      diagnostic_tags: ['graph_shape', 'uniform_acceleration', 'v_t_graph'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-035',
      skill: 'data',
      primary_skill: 'data',
      secondary_skill: 'problem_solving',
      sub_skill: 'oscilloscope_reading',
      difficulty: 4,
      question:
        'على شاشة راسم الاهتزاز الكهربائي، القيمة الحساسة الأفقية هي 10 ms/تقسيمة، وتشغل دورة كاملة أفقياً 4 تقسيمات. ما قيمة الدورة T؟',
      options: [
        { id: 'A', text: '40 ms', diagnostic_tag: null },
        { id: 'B', text: '10 ms', diagnostic_tag: 'single_division_reading' },
        { id: 'C', text: '4 s', diagnostic_tag: 'unit_not_converted' },
        { id: 'D', text: '2.5 ms', diagnostic_tag: 'division_instead_of_multiplication' }
      ],
      correct: 'A',
      explanation: 'T = عدد التقسيمات × القيمة الحساسة = 4 × 10 = 40 ms.',
      diagnostic_tags: ['oscilloscope_reading', 'period_reading', 'scale_multiplication'],
      weight: 1
    },

    // ===================== SKILL: problem_solving (8) =====================
    {
      id: 'PHY-DIAG-005',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'math',
      sub_skill: 'simple_acceleration',
      difficulty: 2,
      question:
        'سيارة انطلقت من السكون وبلغت سرعة 30 m/s بعد مدة قدرها 10 s. ما تسارعها المتوسط؟',
      options: [
        { id: 'A', text: '3 m/s²', diagnostic_tag: null },
        { id: 'B', text: '0.33 m/s²', diagnostic_tag: 'inverted_fraction' },
        { id: 'C', text: '300 m/s²', diagnostic_tag: 'multiplication_instead_of_division' },
        { id: 'D', text: '20 m/s²', diagnostic_tag: 'wrong_delta_value' }
      ],
      correct: 'A',
      explanation:
        'a = (v − v₀) / t = (30 − 0) / 10 = 3 m/s².',
      diagnostic_tags: ['extract_data', 'select_formula', 'acceleration', 'calculation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-011',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'math',
      sub_skill: 'free_fall_duration',
      difficulty: 2,
      question:
        'جسم سقط سقوطًا حرًا من ارتفاع h = 20 m بدون سرعة ابتدائية (خذ g = 10 m/s²). ما مدة السقوط؟',
      options: [
        { id: 'A', text: '2 s', diagnostic_tag: null },
        { id: 'B', text: '4 s', diagnostic_tag: 'forgot_square_root' },
        { id: 'C', text: '40 s', diagnostic_tag: 'multiplication_instead_of_division' },
        { id: 'D', text: '1 s', diagnostic_tag: 'half_time_error' }
      ],
      correct: 'A',
      explanation:
        'من h = ½ g t²: t² = 2h/g = 4، إذن t = 2 s.',
      diagnostic_tags: ['free_fall', 'select_formula', 'solve_equation', 'calculation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-017',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'math',
      sub_skill: 'kinetic_energy',
      difficulty: 3,
      question:
        'جسم كتلته m = 2 kg يتحرك بسرعة v = 3 m/s. ما طاقته الحركية؟',
      options: [
        { id: 'A', text: '9 J', diagnostic_tag: null },
        { id: 'B', text: '18 J', diagnostic_tag: 'forgot_half' },
        { id: 'C', text: '6 J', diagnostic_tag: 'mv_formula_used' },
        { id: 'D', text: '36 J', diagnostic_tag: 'mv2_without_half' }
      ],
      correct: 'A',
      explanation: 'Ec = ½ m v² = ½ × 2 × 9 = 9 J.',
      diagnostic_tags: ['kinetic_energy', 'select_formula', 'calculation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-022',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'units',
      sub_skill: 'electric_power',
      difficulty: 2,
      question:
        'مصباح يعمل تحت توتر U = 12 V ويمر فيه تيار شدته I = 0.5 A. ما قدرته الكهربائية؟',
      options: [
        { id: 'A', text: '6 W', diagnostic_tag: null },
        { id: 'B', text: '24 W', diagnostic_tag: 'division_instead_of_multiplication' },
        { id: 'C', text: '12 W', diagnostic_tag: 'current_ignored' },
        { id: 'D', text: '0.5 W', diagnostic_tag: 'voltage_ignored' }
      ],
      correct: 'A',
      explanation: 'P = U × I = 12 × 0.5 = 6 W.',
      diagnostic_tags: ['electric_power', 'select_formula', 'calculation'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-026',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'units',
      sub_skill: 'half_life',
      difficulty: 3,
      question:
        'عينة مشعة نشاطها الابتدائي A₀ = 1600 Bq ونصف عمرها = يومان. ما نشاطها بعد مرور 6 أيام؟',
      options: [
        { id: 'A', text: '200 Bq', diagnostic_tag: null },
        { id: 'B', text: '800 Bq', diagnostic_tag: 'one_half_life_only' },
        { id: 'C', text: '400 Bq', diagnostic_tag: 'two_half_lives_only' },
        { id: 'D', text: '267 Bq', diagnostic_tag: 'direct_division' }
      ],
      correct: 'A',
      explanation:
        '6 أيام = 3 أنصاف عمر: A = 1600 × (1/2)³ = 200 Bq.',
      diagnostic_tags: ['half_life', 'radioactive_decay', 'repeated_halving'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-032',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'math',
      sub_skill: 'equilibrium_quotient',
      difficulty: 3,
      question:
        'تفاعل التوازن: 2A ⇌ B. عند التوازن [A] = 0.2 mol/L و [B] = 0.8 mol/L. احسب ثابت التوازن Kc = [B]/[A]².',
      options: [
        { id: 'A', text: '20', diagnostic_tag: null },
        { id: 'B', text: '4', diagnostic_tag: 'exponent_not_applied' },
        { id: 'C', text: '0.05', diagnostic_tag: 'inverted_ratio' },
        { id: 'D', text: '2', diagnostic_tag: 'concentration_sum' }
      ],
      correct: 'A',
      explanation: 'Kc = 0.8 / (0.2)² = 0.8 / 0.04 = 20.',
      diagnostic_tags: ['equilibrium_constant', 'concentration_substitution', 'exponent_processing'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-036',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'units',
      sub_skill: 'newton_second_law',
      difficulty: 3,
      question:
        'جسم كتلته m = 500 g يكتسب تسارعًا a = 2 m/s². ما شدة القوة المؤثرة عليه بوحدة N؟',
      options: [
        { id: 'A', text: '1 N', diagnostic_tag: null },
        { id: 'B', text: '1000 N', diagnostic_tag: 'gram_not_converted' },
        { id: 'C', text: '100 N', diagnostic_tag: 'unit_conversion_factor_error' },
        { id: 'D', text: '0.002 N', diagnostic_tag: 'opposite_conversion' }
      ],
      correct: 'A',
      explanation:
        'نحول أولاً 500 g = 0.5 kg، ثم F = m × a = 0.5 × 2 = 1 N.',
      diagnostic_tags: ['mass_conversion', 'newton_second_law', 'unit_conversion'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-040',
      skill: 'problem_solving',
      primary_skill: 'problem_solving',
      secondary_skill: 'math',
      sub_skill: 'multi_step_kinematics',
      difficulty: 4,
      question:
        'سيارة كتلتها 1000 kg تنطلق من السكون بتسارع ثابت a = 2 m/s² لمدة 5 s. ما المسافة التي تقطعها خلال هذه المدة؟',
      options: [
        { id: 'A', text: '25 m', diagnostic_tag: null },
        { id: 'B', text: '50 m', diagnostic_tag: 'forgot_half_fraction' },
        { id: 'C', text: '10 m', diagnostic_tag: 'at_used_without_squaring' },
        { id: 'D', text: '100 m', diagnostic_tag: 'mass_mixed_into_distance' }
      ],
      correct: 'A',
      explanation:
        'd = ½ a t² = ½ × 2 × 25 = 25 m (الكتلة لا تدخل في حساب المسافة هذه).',
      diagnostic_tags: ['multi_step', 'kinematics', 'choose_and_combine_formulas', 'irrelevant_data_filter'],
      weight: 1
    },

    // ===================== SKILL: methodology (4) =====================
    {
      id: 'PHY-DIAG-006',
      skill: 'methodology',
      primary_skill: 'methodology',
      secondary_skill: null,
      sub_skill: 'solution_organization',
      difficulty: 1,
      question: 'ما الترتيب الصحيح لحل مسألة فيزيائية؟',
      options: [
        { id: 'A', text: 'استخراج المعطيات ← تحديد المطلوب ← اختيار القانون ← التعويض ← التحقق', diagnostic_tag: null },
        { id: 'B', text: 'اختيار القانون ثم استخراج المعطيات', diagnostic_tag: 'formula_first_order' },
        { id: 'C', text: 'الحساب المباشر ثم تحديد المطلوب', diagnostic_tag: 'calculation_before_problem' },
        { id: 'D', text: 'التعويض العشوائي ثم التحقق لما يصادف', diagnostic_tag: 'random_substitution' }
      ],
      correct: 'A',
      explanation:
        'المنهجية السليمة تبدأ بفهم المعطيات والمطلوب قبل اختيار القانون المناسب والتعويض ثم التحقق.',
      diagnostic_tags: ['solution_steps', 'methodology', 'organization'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-012',
      skill: 'methodology',
      primary_skill: 'methodology',
      secondary_skill: 'units',
      sub_skill: 'unit_verification',
      difficulty: 1,
      question:
        'بعد إجراء حساب لطاقة، وجد الطالب النتيجة: E = 200 kg·m/s. ما الحكم الصحيح على هذه النتيجة؟',
      options: [
        { id: 'A', text: 'الوحدة غير متجانسة مع الطاقة، فالنتيجة خاطئة', diagnostic_tag: null },
        { id: 'B', text: 'النتيجة صحيحة لأن العدد 200 معقول', diagnostic_tag: 'number_focus_only' },
        { id: 'C', text: 'الوحدة صحيحة لأنها وحدة سرعة', diagnostic_tag: 'unit_for_velocity' },
        { id: 'D', text: 'لا يمكن الحكم من الوحدات وحدها', diagnostic_tag: 'dimensional_check_ignored' }
      ],
      correct: 'A',
      explanation:
        'الطاقة تقاس بالجول J = kg·m²/s². الوحدة الناتجة kg·m/s هي وحدة كمية حركة، فمصدرها خطأ في الحل.',
      diagnostic_tags: ['unit_verification', 'dimensional_analysis', 'verify_result'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-027',
      skill: 'methodology',
      primary_skill: 'methodology',
      secondary_skill: null,
      sub_skill: 'plausibility_check',
      difficulty: 2,
      question:
        'وجد طالب في حل مسألة أن سرعة سيارة تساوي 1080 km/h. ما الصواب في تقييم هذه النتيجة؟',
      options: [
        { id: 'A', text: 'ليست معقولة فيزيائيًا وعليه مراجعة الحساب', diagnostic_tag: null },
        { id: 'B', text: 'معقولة لأن الحساب الرياضي سليم', diagnostic_tag: 'math_over_physics' },
        { id: 'C', text: 'لا يمكن الحكم دون مخطط', diagnostic_tag: 'no_evaluation' },
        { id: 'D', text: 'معقولة إن كانت الطريق سريعة', diagnostic_tag: 'context_irrelevant' }
      ],
      correct: 'A',
      explanation:
        '1080 km/h = 300 m/s تقارب سرعة الصوت، وهي غير واقعية لسيارة؛ تحقق معقولية النتيجة جزء من المنهجية.',
      diagnostic_tags: ['plausibility_check', 'result_verification', 'real_world_sense'],
      weight: 1
    },

    {
      id: 'PHY-DIAG-038',
      skill: 'methodology',
      primary_skill: 'methodology',
      secondary_skill: 'concepts',
      sub_skill: 'logical_reasoning',
      difficulty: 3,
      question:
        'الاستدلال: "بما أن سرعة الجسم ثابتة إذن محصلة القوى المطبقة عليه معدومة". أي عبارة صحيحة؟',
      options: [
        { id: 'A', text: 'الاستدلال صحيح إذا كانت الحركة مستقيمة', diagnostic_tag: null },
        { id: 'B', text: 'الاستدلال صحيح مهما كان شكل المسار', diagnostic_tag: 'circular_motion_overlooked' },
        { id: 'C', text: 'الاستدلال خاطئ دائمًا', diagnostic_tag: 'always_false' },
        { id: 'D', text: 'الاستدلال صحيح فقط في السقوط الحر', diagnostic_tag: 'condition_misplaced' }
      ],
      correct: 'A',
      explanation:
        'ثبات السرعة (كمية قياسية) لا يكفي لاستنتاج انعدام المحصلة؛ فالحركة الدائرية المنتظمة ثابتة السرعة ومحصلة قواها غير معدومة. الاستدلال صحيح للحركة المستقيمة المنتظمة.',
      diagnostic_tags: ['logical_inference', 'newton_laws', 'speed_vs_velocity', 'circular_motion'],
      weight: 1
    }
  ]
};