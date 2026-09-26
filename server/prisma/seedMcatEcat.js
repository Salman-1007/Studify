import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export async function seedMcatEcatCurriculum() {
  console.log('Seeding MDCAT (PMDC) and ECAT (UET) boards and subjects...');

  // 1. PMDC Board for MDCAT
  const pmdcBoard = await prisma.board.upsert({
    where: { code: 'PMDC' },
    update: {
      name: 'Pakistan Medical & Dental Council (PMDC)',
      description: 'Official PMDC National Curriculum for MDCAT Medical College Admission',
    },
    create: {
      name: 'Pakistan Medical & Dental Council (PMDC)',
      code: 'PMDC',
      description: 'Official PMDC National Curriculum for MDCAT Medical College Admission',
    },
  });

  // 2. UET Board for ECAT
  const uetBoard = await prisma.board.upsert({
    where: { code: 'UET' },
    update: {
      name: 'University of Engineering & Technology (UET)',
      description: 'Official UET Combined Entry Test for Engineering & Computing Programs',
    },
    create: {
      name: 'University of Engineering & Technology (UET)',
      code: 'UET',
      description: 'Official UET Combined Entry Test for Engineering & Computing Programs',
    },
  });

  // 3. MDCAT Subjects
  const mdcatSubjects = [
    {
      subjectName: 'Biology',
      bookName: 'MDCAT Biology (PMDC)',
      code: 'MDCAT-BIO',
      description: 'MDCAT Biology: Cell Biology, Bioenergetics, Coordination, Genetics & Life Processes (45% weightage - 81 MCQs)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Cell Structure and Function',
          description: 'Eukaryotic and prokaryotic organelles, membrane transport, cell wall, and cellular fractionation.',
          questions: [
            {
              questionText: 'Which organelle is known as the powerhouse of the cell and produces ATP through oxidative phosphorylation?',
              optionA: 'Endoplasmic reticulum',
              optionB: 'Mitochondria',
              optionC: 'Golgi apparatus',
              optionD: 'Lysosome',
              correctAnswer: 'B',
              explanation: 'Mitochondria generate the majority of cellular adenosine triphosphate (ATP) via aerobic cellular respiration.',
              difficulty: 'EASY',
            },
            {
              questionText: 'The fluid mosaic model describes the plasma membrane as composed primarily of:',
              optionA: 'A static monolayer of proteins',
              optionB: 'A phospholipid bilayer with interspersed and peripheral proteins',
              optionC: 'Rigid carbohydrate polymers',
              optionD: 'Pure nucleic acid matrices',
              correctAnswer: 'B',
              explanation: 'Proposed by Singer and Nicolson, the fluid mosaic model depicts a fluid lipid bilayer studded with integral and peripheral proteins.',
              difficulty: 'MEDIUM',
            },
            {
              questionText: 'Which organelle contains hydrolytic acid hydrolase enzymes responsible for autolysis and intracellular digestion?',
              optionA: 'Peroxisome',
              optionB: 'Lysosome',
              optionC: 'Centriole',
              optionD: 'Ribosome',
              correctAnswer: 'B',
              explanation: 'Lysosomes contain acidic hydrolases active at pH ~5 to break down cellular waste and foreign materials.',
              difficulty: 'MEDIUM',
            },
          ],
        },
        {
          chapterNumber: 2,
          chapterName: 'Bioenergetics and Cellular Respiration',
          description: 'Photosynthesis, glycolysis, Krebs cycle, and electron transport chain.',
          questions: [
            {
              questionText: 'In aerobic cellular respiration, how many net molecules of ATP are typically produced from one molecule of glucose during glycolysis alone?',
              optionA: '2 ATP',
              optionB: '4 ATP',
              optionC: '32 ATP',
              optionD: '36 ATP',
              correctAnswer: 'A',
              explanation: 'Glycolysis consumes 2 ATP in the preparatory phase and produces 4 ATP in the payoff phase, yielding a net gain of 2 ATP.',
              difficulty: 'MEDIUM',
            },
            {
              questionText: 'Where does the Krebs (citric acid) cycle take place in eukaryotic cells?',
              optionA: 'Cytosol',
              optionB: 'Mitochondrial matrix',
              optionC: 'Inner mitochondrial membrane',
              optionD: 'Intermembrane space',
              correctAnswer: 'B',
              explanation: 'The citric acid cycle enzymes are solubilized within the mitochondrial matrix, while the electron transport chain resides in the inner membrane cristae.',
              difficulty: 'HARD',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'Chemistry',
      bookName: 'MDCAT Chemistry (PMDC)',
      code: 'MDCAT-CHM',
      description: 'MDCAT Chemistry: Physical, Inorganic, and Organic Chemistry fundamentals (25% weightage - 45 MCQs)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Atomic Structure and Chemical Bonding',
          description: 'Quantum numbers, orbital hybridization, and intermolecular forces.',
          questions: [
            {
              questionText: 'What is the hybridization and bond angle in a methane (CH4) molecule?',
              optionA: 'sp2, 120°',
              optionB: 'sp3, 109.5°',
              optionC: 'sp, 180°',
              optionD: 'dsp2, 90°',
              correctAnswer: 'B',
              explanation: 'Carbon in methane forms four equivalent sigma bonds via sp3 hybrid orbitals arranged in a regular tetrahedron with 109.5° bond angles.',
              difficulty: 'MEDIUM',
            },
            {
              questionText: 'Which quantum number determines the spatial orientation of an electron orbital in a magnetic field?',
              optionA: 'Principal quantum number (n)',
              optionB: 'Azimuthal quantum number (l)',
              optionC: 'Magnetic quantum number (m)',
              optionD: 'Spin quantum number (s)',
              correctAnswer: 'C',
              explanation: 'The magnetic quantum number (m) determines the spatial orientation of the orbital in three-dimensional space.',
              difficulty: 'MEDIUM',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'Physics',
      bookName: 'MDCAT Physics (PMDC)',
      code: 'MDCAT-PHY',
      description: 'MDCAT Physics: Mechanics, Thermodynamics, Waves, and Modern Physics (20% weightage - 36 MCQs)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Force, Motion and Energy',
          description: 'Newtonian dynamics, momentum conservation, and work-energy theorem.',
          questions: [
            {
              questionText: 'A body of mass 2 kg moving at 10 m/s collides and sticks to an identical body at rest. What is their common velocity after collision?',
              optionA: '2.5 m/s',
              optionB: '5.0 m/s',
              optionC: '10.0 m/s',
              optionD: '20.0 m/s',
              correctAnswer: 'B',
              explanation: 'By conservation of linear momentum: m1*v1 = (m1 + m2)*vf => 2*10 = 4*vf => vf = 5 m/s.',
              difficulty: 'MEDIUM',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'English',
      bookName: 'MDCAT English (PMDC)',
      code: 'MDCAT-ENG',
      description: 'MDCAT English: Advanced vocabulary, subject-verb agreement, and contextual comprehension (5% weightage - 9 MCQs)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Grammatical Structure and Vocabulary',
          description: 'Tenses, prepositions, concord, and vocabulary in context.',
          questions: [
            {
              questionText: 'Choose the correct sentence following rules of subject-verb agreement:',
              optionA: 'Neither the doctor nor the nurses was available.',
              optionB: 'Neither the doctor nor the nurses were available.',
              optionC: 'Neither the doctor or the nurses are available.',
              optionD: 'Neither the doctors nor the nurse were available.',
              correctAnswer: 'B',
              explanation: 'When subjects are connected by "neither... nor", the verb agrees with the closer subject ("nurses" is plural, so "were" is correct).',
              difficulty: 'MEDIUM',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'Logical Reasoning',
      bookName: 'MDCAT Logical Reasoning (PMDC)',
      code: 'MDCAT-LOG',
      description: 'MDCAT Logical Reasoning: Syllogisms, sequence patterns, and critical deduction (5% weightage - 9 MCQs)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Logical Deductions and Critical Thinking',
          description: 'Premise analysis, series completion, and causal relationships.',
          questions: [
            {
              questionText: 'Identify the next term in the logical series: 2, 6, 12, 20, 30, ___?',
              optionA: '36',
              optionB: '40',
              optionC: '42',
              optionD: '48',
              correctAnswer: 'C',
              explanation: 'Differences between consecutive numbers increase by 2: +4, +6, +8, +10, +12. So 30 + 12 = 42 (also n*(n+1) for n=1..6).',
              difficulty: 'MEDIUM',
            },
          ],
        },
      ],
    },
  ];

  // 4. ECAT Subjects
  const ecatSubjects = [
    {
      subjectName: 'Mathematics',
      bookName: 'ECAT Mathematics (UET)',
      code: 'ECAT-MTH',
      description: 'ECAT Mathematics: Calculus, Algebra, Trigonometry, and Analytical Geometry (30% weightage - 30 MCQs / 120 marks)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Calculus and Analytical Geometry',
          description: 'Limits, derivatives, definite integrals, and conics.',
          questions: [
            {
              questionText: 'Evaluate the limit: lim(x -> 0) [sin(3x) / x]:',
              optionA: '0',
              optionB: '1',
              optionC: '3',
              optionD: 'Infinity',
              correctAnswer: 'C',
              explanation: 'Using the fundamental limit identity lim(t->0) [sin(t)/t] = 1: lim(x->0) [3 * sin(3x)/(3x)] = 3 * 1 = 3.',
              difficulty: 'MEDIUM',
            },
            {
              questionText: 'What is the derivative of f(x) = ln(cos x) with respect to x?',
              optionA: 'sec(x)',
              optionB: '-tan(x)',
              optionC: 'cot(x)',
              optionD: '-cot(x)',
              correctAnswer: 'B',
              explanation: 'By the chain rule: d/dx[ln(cos x)] = (1/cos x) * (-sin x) = -tan(x).',
              difficulty: 'HARD',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'Physics',
      bookName: 'ECAT Physics (UET)',
      code: 'ECAT-PHY',
      description: 'ECAT Physics: Mechanics, Electromagnetism, Thermodynamics, and Modern Physics (30% weightage - 30 MCQs / 120 marks)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Rotational Motion and Work-Energy',
          description: 'Angular acceleration, moment of inertia, and rotational kinetic energy.',
          questions: [
            {
              questionText: 'A wheel of radius 0.5 m accelerates uniformly from rest to 12 rad/s in 4 seconds. What is its angular acceleration?',
              optionA: '3 rad/s^2',
              optionB: '6 rad/s^2',
              optionC: '24 rad/s^2',
              optionD: '48 rad/s^2',
              correctAnswer: 'A',
              explanation: 'Angular acceleration α = (ωf - ωi) / t = (12 - 0) / 4 = 3 rad/s^2.',
              difficulty: 'MEDIUM',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'Chemistry',
      bookName: 'ECAT Chemistry (UET)',
      code: 'ECAT-CHM',
      description: 'ECAT Chemistry: Physical, Inorganic, and Industrial Chemistry principles (30% weightage - 30 MCQs / 120 marks)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Chemical Equilibrium and Thermodynamics',
          description: 'Le Chatelier principle, equilibrium constants, and enthalpy changes.',
          questions: [
            {
              questionText: 'For an exothermic reversible reaction at equilibrium, increasing the temperature will:',
              optionA: 'Shift the equilibrium forward and increase Kp',
              optionB: 'Shift the equilibrium backward and decrease Kp',
              optionC: 'Have no effect on equilibrium composition',
              optionD: 'Accelerate the forward reaction only',
              correctAnswer: 'B',
              explanation: 'By Le Chatelier\'s principle, adding heat to an exothermic reaction shifts the equilibrium toward the reactants (endothermic direction), reducing K.',
              difficulty: 'HARD',
            },
          ],
        },
      ],
    },
    {
      subjectName: 'English',
      bookName: 'ECAT English (UET)',
      code: 'ECAT-ENG',
      description: 'ECAT English: Comprehension, sentence correction, and vocabulary (10% weightage - 10 MCQs / 40 marks)',
      chapters: [
        {
          chapterNumber: 1,
          chapterName: 'Sentence Completion and Error Detection',
          description: 'Syntactic structures, idiom usage, and vocabulary context.',
          questions: [
            {
              questionText: 'Choose the word most nearly opposite in meaning (antonym) to "EPHEMERAL":',
              optionA: 'Transient',
              optionB: 'Permanent',
              optionC: 'Fleeting',
              optionD: 'Elusive',
              correctAnswer: 'B',
              explanation: '"Ephemeral" means lasting for a very short time; its antonym is "permanent" or "eternal".',
              difficulty: 'MEDIUM',
            },
          ],
        },
      ],
    },
  ];

  // Helper function to seed track
  const seedTrack = async (board, classGrade, subjectsList) => {
    for (const sub of subjectsList) {
      const subjectRecord = await prisma.curriculumSubject.upsert({
        where: {
          boardId_classGrade_subjectName: {
            boardId: board.id,
            classGrade,
            subjectName: sub.subjectName,
          },
        },
        update: {
          bookName: sub.bookName,
          code: sub.code,
          description: sub.description,
        },
        create: {
          boardId: board.id,
          classGrade,
          subjectName: sub.subjectName,
          bookName: sub.bookName,
          code: sub.code,
          description: sub.description,
        },
      });

      for (const ch of sub.chapters) {
        const chapterRecord = await prisma.curriculumChapter.upsert({
          where: {
            subjectId_chapterNumber: {
              subjectId: subjectRecord.id,
              chapterNumber: ch.chapterNumber,
            },
          },
          update: {
            chapterName: ch.chapterName,
            description: ch.description,
          },
          create: {
            subjectId: subjectRecord.id,
            chapterNumber: ch.chapterNumber,
            chapterName: ch.chapterName,
            description: ch.description,
          },
        });

        for (const q of ch.questions) {
          const normalized = normalizeText(q.questionText);
          const existing = await prisma.questionBankItem.findFirst({
            where: {
              chapterId: chapterRecord.id,
              normalizedText: normalized,
            },
          });

          if (!existing) {
            await prisma.questionBankItem.create({
              data: {
                boardId: board.id,
                classGrade,
                subjectId: subjectRecord.id,
                chapterId: chapterRecord.id,
                questionText: q.questionText,
                normalizedText: normalized,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                difficulty: q.difficulty || 'MEDIUM',
                status: 'APPROVED',
                questionType: 'MCQ',
                sourceType: 'ORIGINAL',
                sourceReference: `Official Entry Blueprint - ${sub.bookName}`,
              },
            });
          }
        }
      }
    }
  };

  await seedTrack(pmdcBoard, 'MDCAT', mdcatSubjects);
  await seedTrack(uetBoard, 'ECAT', ecatSubjects);

  console.log('MDCAT and ECAT tracks successfully seeded!');
}

async function main() {
  await seedMcatEcatCurriculum();
}

main()
  .catch((err) => {
    console.error('MDCAT/ECAT seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
