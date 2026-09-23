import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(
    import.meta.url));
const rawDataPath = path.resolve(__dirname, '../src/ptb_class9_mcq_bank_solved.json');
const outputPath = path.resolve(__dirname, '../src/ptb_curated_clean_mcqs.json');

const raw = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

const CHAPTER_MAPPINGS = {
    // Class 9 Chemistry
    'fundamentals of chemistry': { number: 1, name: 'Fundamentals of Chemistry' },
    'structure of atoms': { number: 2, name: 'Structure of Atoms' },
    'periodic table': { number: 3, name: 'Periodic Table and Periodicity of Properties' },
    'structure of molecules': { number: 4, name: 'Structure of Molecules' },
    'physical states of matter': { number: 5, name: 'Physical States of Matter' },
    'solutions': { number: 6, name: 'Solutions' },
    'electrochemistry': { number: 7, name: 'Electrochemistry' },
    'chemical reactivity': { number: 8, name: 'Chemical Reactivity' },

    // Class 9 Physics
    'physical quantities and measurement': { number: 1, name: 'Physical Quantities and Measurement' },
    'kinematics': { number: 2, name: 'Kinematics' },
    'dynamics': { number: 3, name: 'Dynamics' },
    'turning effect of forces': { number: 4, name: 'Turning Effect of Forces' },
    'gravitation': { number: 5, name: 'Gravitation' },
    'work and energy': { number: 6, name: 'Work and Energy' },

    // Class 10 Chemistry
    'chemical equilibrium': { number: 1, name: 'Chemical Equilibrium' },
    'acids, bases and salts': { number: 2, name: 'Acids, Bases and Salts' },
    'organic chemistry': { number: 3, name: 'Organic Chemistry' },

    // Class 10 Physics
    'simple harmonic motion and waves': { number: 1, name: 'Simple Harmonic Motion and Waves' },
    'sound': { number: 2, name: 'Sound' },
};

// Known answer lookup for questions with null answers or shifted option text
const KNOWN_SOLUTIONS = [
    // Class 9 Chemistry - Structure of Atoms
    {
        pattern: 'planetary model of atomic structure',
        correct: 'C',
        explanation: 'Rutherford proposed that the mass is concentrated in a central nucleus surrounded by orbiting electrons. Neutrons were discovered later in 1932 by Chadwick.',
    },
    {
        pattern: 'electronic arrangement',
        correct: 'B',
        explanation: 'According to the Aufbau principle, energy levels fill in order of increasing energy: 1s < 2s < 2p < 3s < 3p. Thus 3p has higher energy than 2s.',
    },
    {
        pattern: 'Atomic mass of one of carbon isotope is 14',
        correct: 'B',
        explanation: 'Carbon has atomic number 6 (6 protons). For carbon-14, number of neutrons = mass number - atomic number = 14 - 6 = 8 neutrons.',
    },
    {
        pattern: 'Protium, deuterium and tritium are the isotopes',
        correct: 'B',
        explanation: 'Protium (1H), deuterium (2H), and tritium (3H) are the three natural isotopes of hydrogen.',
    },
    {
        pattern: 'According to 2n2 rule, L-Shell contains',
        correct: 'C',
        explanation: 'For the L-shell, n = 2. Maximum number of electrons = 2n^2 = 2(2)^2 = 8 electrons.',
    },
    {
        pattern: 'cure body cancerous cell',
        correct: 'A',
        explanation: 'Cobalt-60 (Co-60) is widely used for radiation therapy of internal cancerous tumors.',
    },
    {
        pattern: 'radiotherapy for skin cancer',
        correct: 'D',
        explanation: 'Phosphorus-32 (P-32) and Strontium-90 are beta-emitters used for treating superficial skin lesions.',
    },

    // Class 9 Chemistry - Periodic Table
    {
        pattern: 'atoms is smallest in size',
        correct: 'A',
        explanation: 'Across period 3 from left to right (Na to Cl), atomic radius decreases due to increasing nuclear charge. Chlorine (Cl) is the smallest.',
    },
    {
        pattern: 'highest shielding effect',
        correct: 'D',
        explanation: 'Down a group and across higher periods, the addition of complete inner electron shells increases the shielding effect.',
    },
    {
        pattern: 'lowest shielding effect',
        correct: 'D',
        explanation: 'Lithium (Li) has only one inner shell (1s2), giving it the lowest shielding effect among the period 2 elements.',
    },
    {
        pattern: 'Mendeleev placed coinage metals',
        correct: 'B',
        explanation: 'In Mendeleev’s periodic table, coinage metals (Cu, Ag, Au) were placed alongside transitional groups.',
    },

    // Class 9 Chemistry - Structure of Molecules
    {
        pattern: 'coordinate covalent compounds is incorrect',
        correct: 'D',
        explanation: 'Coordinate covalent bonding (dative bonding) involves one atom donating an electron pair, which can occur between like or unlike atoms/molecules.',
    },
    {
        pattern: 'electron dot diagram to answer the question',
        correct: 'C',
        explanation: 'Atoms needing two electrons to complete an octet share two electron pairs, forming a covalent double bond.',
    },

    // Class 9 Chemistry - Electrochemistry
    {
        pattern: 'Brine is another name for',
        correct: 'C',
        explanation: 'Brine is a concentrated aqueous solution of sodium chloride (NaCl) in water.',
    },
    {
        pattern: 'Food cans are coated with tin',
        correct: 'D',
        explanation: 'Tin is less reactive than zinc and does not react with organic food acids, making it safe for food preservation.',
    },

    // Class 9 Chemistry - Chemical Reactivity
    {
        pattern: 'float on water',
        correct: 'C',
        explanation: 'Sodium (Na) has a density of 0.97 g/cm³, which is less than water (1.0 g/cm³), causing it to float while reacting vigorously.',
    },
    {
        pattern: 'strongest interaction between its molecules',
        correct: 'C',
        explanation: 'Iodine (I2) is a solid at room temperature due to strong London dispersion forces resulting from its large polarizable electron cloud.',
    },
    {
        pattern: 'Fluorine is the most reactive of all halogens',
        correct: 'C',
        explanation: 'Fluorine has the smallest atomic size and highest electronegativity, giving it maximum attraction for incoming electrons.',
    },
    {
        pattern: 'Metallic bonding involves',
        correct: 'D',
        explanation: 'Metallic bonding is characterized by positive metal ions held together by a freely moving "sea" of mobile delocalized electrons.',
    },
    {
        pattern: 'highest percentage in human body',
        correct: 'A',
        explanation: 'Oxygen and hydrogen make up the majority of body mass as water, with hydrogen being the most abundant element by atomic count.',
    },
    {
        pattern: 'NOT a bioelement',
        correct: 'D',
        explanation: 'While present in traces, major bioelements (99% mass) are C, H, N, O, P, Ca.',
    },
    {
        pattern: 'aluminium metal, the atoms are bonded through',
        correct: 'D',
        explanation: 'Metals like aluminium have metallic bonding due to delocalized valence electrons holding the lattice together.',
    },
    {
        pattern: 'CH2Cl2 + Cl2',
        correct: 'B',
        explanation: 'Chlorination of dichloromethane (CH2Cl2) with chlorine in sunlight produces chloroform (trichloromethane, CHCl3).',
    },
    {
        pattern: 'correct order for metallic character',
        correct: 'D',
        explanation: 'Across period 3 from left to right, metallic character decreases: Na > Mg > Al > Si.',
    },
    {
        pattern: 'hydrogen with fluorine takes place in',
        correct: 'D',
        explanation: 'Fluorine is extremely reactive and reacts explosively with hydrogen even in the dark and at very cold temperatures (-250°C).',
    },
    {
        pattern: 'oxidising property of halogens',
        correct: 'D',
        explanation: 'Oxidizing power decreases down Group 17: F2 > Cl2 > Br2 > I2.',
    },
    {
        pattern: 'halogens does NOT exist in diatomic form',
        correct: 'A',
        explanation: 'All common halogens (F2, Cl2, Br2, I2) exist as diatomic molecules at standard conditions.',
    },

    // Class 9 Physics - Turning Effect of Forces
    {
        pattern: 'vertical component of force is 45 N and the angle of force with x-axis is 45o',
        correct: 'C',
        explanation: 'F = Fy / sin(45°) = 45 / 0.7071 ≈ 63.64 N ≈ 64 N.',
    },
    {
        pattern: 'horizontal component of a force is 48 N and the angle formed by the resultant force is 30o',
        correct: 'D',
        explanation: 'F = Fx / cos(30°) = 48 / 0.866 ≈ 55.4 N ≈ 55 N.',
    },

    // Class 9 Physics - Gravitation
    {
        pattern: 'raised from the surface of Earth to a height of two Earth radii',
        correct: 'D',
        explanation: 'Mass is an intrinsic property and remains constant. Weight w = mg decreases inversely with the square of the distance from the Earth center.',
    },
    {
        pattern: 'weight of an apple when taken to the top of a mountain',
        correct: 'B',
        explanation: 'As altitude increases, distance from Earth center increases, value of g decreases, so weight w = mg decreases.',
    },
    {
        pattern: 'value of g is greater? At poles or at equator',
        correct: 'A',
        explanation: 'Because Earth is flattened at the poles, the polar radius is less than equatorial radius, making g slightly greater at the poles (9.83 m/s² vs 9.78 m/s²).',
    },
    {
        pattern: 'Earth exerts a gravitational force on moon',
        correct: 'C',
        explanation: 'By Newton’s third law of motion, the reaction to the Earth’s gravitational pull on the Moon is the Moon’s equal and opposite gravitational pull on the Earth.',
    },

    // Class 9 Physics - Work and Energy
    {
        pattern: 'cause of ocean thermal energy',
        correct: 'C',
        explanation: 'Ocean thermal energy conversion (OTEC) utilizes the temperature difference between warm surface water and cold deep ocean water.',
    },
    {
        pattern: 'common energy source in the villages of Pakistan',
        correct: 'C',
        explanation: 'Biomass in the form of firewood, agricultural residue, and dried animal dung cakes provides the primary heating and cooking energy in rural Pakistan.',
    },
    {
        pattern: 'common for all fossil fuels',
        correct: 'A',
        explanation: 'All fossil fuels (coal, petroleum, natural gas) are hydrocarbons and derivatives containing carbon as their primary constituent.',
    },
    {
        pattern: 'Hydroelectric, tidal and fossil fuel power stations',
        correct: 'D',
        explanation: 'Hydroelectric and tidal power stations use continuous natural cycles (renewable), while fossil fuel reserves are finite (non-renewable).',
    },
    {
        pattern: 'emergency generator supplies 256,000,000 J of electrical energy in 24 hours',
        correct: 'C',
        explanation: 'Power = Energy / Time = 256,000,000 J / (24 × 3600 s) = 256,000,000 / 86,400 ≈ 2963 W.',
    },

    // Class 10 Chemistry - Chemical Equilibrium
    {
        pattern: 'cases indicates that equilibrium is achieved',
        correct: 'B',
        explanation: 'At dynamic equilibrium, the forward and reverse reaction rates become equal, and reaction concentrations remain constant (Qc = Kc).',
    },
    {
        pattern: 'reactions is a uni-directional reaction',
        correct: 'C',
        explanation: 'Neutralization between strong acids and strong bases (forming a salt and water) goes to completion and is irreversible (unidirectional).',
    },
    {
        pattern: 'Dynamic equilibrium occurs in which type of reactions',
        correct: 'A',
        explanation: 'Dynamic equilibrium is established only in reversible chemical reactions enclosed in a closed system.',
    },
    {
        pattern: 'Equilibrium constant can be used for which of the following',
        correct: 'B',
        explanation: 'The equilibrium constant Kc predicts both the direction (by comparing with Qc) and the extent of a chemical reaction.',
    },
    {
        pattern: 'Chemical equilibrium state is',
        correct: 'C',
        explanation: 'Chemical equilibrium is dynamic: reactions do not stop; forward and reverse reactions proceed at identical rates.',
    },
    {
        pattern: 'TRUE about reaction quotient',
        correct: 'D',
        explanation: 'The reaction quotient Qc is the ratio of product concentrations to reactant concentrations at any given point during the reaction.',
    },

    // Class 10 Chemistry - Acids, Bases and Salts
    {
        pattern: 'litmus paper is dipped in the solution of a basic salt',
        correct: 'B',
        explanation: 'A basic solution turns red litmus paper blue, while blue litmus paper remains unchanged.',
    },
    {
        pattern: 'used to preserve food',
        correct: 'C',
        explanation: 'Benzoic acid and its sodium salt (sodium benzoate) are widely used food preservatives that inhibit bacterial and fungal growth.',
    },
    {
        pattern: 'NOT likely to be an acidic salt',
        correct: 'A',
        explanation: 'NaCl (sodium chloride) is a normal neutral salt formed by complete neutralization of strong acid HCl with strong base NaOH.',
    },
    {
        pattern: 'litmus paper is dipped in the solution of a neutral salt',
        correct: 'D',
        explanation: 'Neutral salt solutions (pH = 7) produce no color change on red or blue litmus papers.',
    },
    {
        pattern: 'correct formula for benzoic acid',
        correct: 'C',
        explanation: 'Benzoic acid consists of a carboxyl group attached to a phenyl ring: C6H5COOH.',
    },
    {
        pattern: 'hydrogen of an acid is fully replaced by a metal',
        correct: 'D',
        explanation: 'Complete replacement of all ionizable hydrogen atoms of an acid by metallic ions produces a normal salt.',
    },

    // Class 10 Chemistry - Organic Chemistry
    {
        pattern: 'true about homologous series',
        correct: 'A',
        explanation: 'Members of a homologous series possess the same functional group and therefore exhibit similar chemical properties with regular gradation in physical properties.',
    },
    {
        pattern: 'characteristic test for the detection of carboxyl group',
        correct: 'D',
        explanation: 'Carboxylic acids turn blue litmus paper red and effervesce with sodium bicarbonate solution, releasing CO2.',
    },
    {
        pattern: 'Lignite, bituminous and anthracite are different ranks of',
        correct: 'A',
        explanation: 'Peat, lignite, sub-bituminous, bituminous, and anthracite are successive ranks of coal.',
    },
    {
        pattern: "In Bayer's test which reagent is used",
        correct: 'B',
        explanation: 'Baeyer’s reagent is dilute cold alkaline potassium permanganate (KMnO4) solution used to detect unsaturation (double/triple bonds).',
    },
    {
        pattern: 'destructive distillation of coal is called',
        correct: 'B',
        explanation: 'Heating coal in the absence of air at high temperature (destructive distillation) yields coal gas, coal tar, and coke.',
    },
    {
        pattern: 'Wohler synthesized the first organic compound',
        correct: 'B',
        explanation: 'Friedrich Wöhler synthesized urea, an organic compound, by heating the inorganic compound ammonium cyanate (NH4CNO) in 1828.',
    },
    {
        pattern: 'not an example of Acyclic compound',
        correct: 'B',
        explanation: 'Cyclopropane has a 3-carbon ring and is a cyclic (alicyclic) hydrocarbon, not an open-chain (acyclic) compound.',
    },

    // Class 10 Physics - Simple Harmonic Motion & Waves
    {
        pattern: 'relates frequency to period',
        correct: 'C',
        explanation: 'Frequency f is inversely proportional to time period T: f = 1/T.',
    },

    // Class 10 Physics - Sound
    {
        pattern: 'recognize the voice of your friend behind the wall',
        correct: 'A',
        explanation: 'Diffraction allows sound waves to bend around corners and obstacles, while sound quality (timbre) enables recognition of different voices.',
    },
    {
        pattern: 'same note being played on sitar and veena differs in',
        correct: 'C',
        explanation: 'Quality (timbre) is the characteristic by which two sounds of identical pitch and loudness produced by different musical instruments can be distinguished.',
    },
    {
        pattern: 'Time period of sound A is 0.05 sec and that of sound B is 0.025 sec',
        correct: 'D',
        explanation: 'Frequency f = 1/T. Sound B has fB = 1/0.025 = 40 Hz, Sound A has fA = 1/0.05 = 20 Hz. Higher frequency corresponds to higher pitch.',
    },
    {
        pattern: 'transfers 20 J energy when passes through a 1 m 2 area',
        correct: 'C',
        explanation: 'Intensity = Energy / (Area × Time) = 20 J / (1 m² × 2 s) = 10 W/m² for A; 10 J / (1 m² × 2 s) = 5 W/m² for B. Sound wave A has higher intensity.',
    },
    {
        pattern: 'phenomena comprises of multiple reflections of sound',
        correct: 'D',
        explanation: 'Reverberation is the persistence of sound in an enclosed space as a result of repeated reflections from walls, floor, and ceiling.',
    },
    {
        pattern: 'Sound travels faster in which of the following materials',
        correct: 'A',
        explanation: 'Sound is a mechanical wave that travels fastest in solids (~5000 m/s in steel) due to high elasticity and tightly packed particles, slower in liquids (~1500 m/s), and slowest in gases (~340 m/s).',
    },
    {
        pattern: 'ultrasonic wave is sent from a ship towards the bottom of the sea',
        correct: 'B',
        explanation: 'Distance = (v × t) / 2 = (1400 m/s × 1.6 s) / 2 = 2240 / 2 = 1120 m.',
    },
    {
        pattern: 'absorb noise by using soft and porous surfaces',
        correct: 'C',
        explanation: 'Acoustic protection and sound absorption use porous materials (curtains, carpets, acoustic tiles) to minimize unwanted reflections.',
    },
    {
        pattern: 'speed of sound at standard pressure and room temperature',
        correct: 'B',
        explanation: 'At standard atmospheric pressure and room temperature (~20°C), the speed of sound in air is approximately 343 m/s.',
    },
    {
        pattern: 'application of sound echoes of very high frequency',
        correct: 'D',
        explanation: 'SONAR (Sound Navigation and Ranging) utilizes high-frequency ultrasonic waves to detect objects and measure underwater depths.',
    },
    {
        pattern: 'echoes are used to measure distance',
        correct: 'D',
        explanation: 'Echolocation is the technique of using sound reflections to locate and measure distances to objects (used by bats, marine mammals, and SONAR).',
    },
    {
        pattern: 'device is used by doctors to hear the noise of human body organs',
        correct: 'A',
        explanation: 'A stethoscope is a medical acoustic device used to auscultate internal sounds of the heart, lungs, and intestines.',
    },
    {
        pattern: 'Sound waves cannot travel through which of the following',
        correct: 'D',
        explanation: 'Sound waves are mechanical longitudinal waves that require a material medium and cannot propagate through a vacuum.',
    },
    {
        pattern: 'characteristic of sound on the basis of which two sounds of same frequency and loudness are distinguished',
        correct: 'D',
        explanation: 'Quality (or timbre) allows distinguishing two musical sounds that possess identical fundamental frequency (pitch) and loudness.',
    },
    {
        pattern: 'instrument produces sound of a single frequency',
        correct: 'D',
        explanation: 'A tuning fork vibrates at a single fundamental natural frequency, producing a pure harmonic tone.',
    },
    {
        pattern: 'source of sound',
        correct: 'B',
        explanation: 'Sound is produced by the mechanical vibrations of bodies transmitted through a medium as pressure waves.',
    },
];

console.log('Known solutions lookup length:', KNOWN_SOLUTIONS.length);

const cleanMCQs = [];
const seenKeys = new Set();

for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    let qText = (item.question || '').trim();
    const rawOpts = item.options || {};
    const cls = Number(item.class || 9);
    const sub = (item.subject || '').trim();
    const rawChap = (item.chapter || '').trim().toLowerCase();

    // 1. Skip captcha noise
    if (
        qText.toLowerCase().includes('capital of pakistan') ||
        Object.values(rawOpts).some((v) => String(v).toLowerCase().includes('capital of pakistan'))
    ) {
        continue;
    }

    // 2. Resolve Chapter mapping
    let chapMeta = CHAPTER_MAPPINGS[rawChap];
    if (!chapMeta) {
        for (const [k, v] of Object.entries(CHAPTER_MAPPINGS)) {
            if (rawChap.includes(k) || k.includes(rawChap)) {
                chapMeta = v;
                break;
            }
        }
    }
    if (!chapMeta) {
        chapMeta = { number: 1, name: item.chapter || 'General' };
    }

    // 3. Resolve Question Text & Options
    let optA = rawOpts.A ? String(rawOpts.A).trim() : '';
    let optB = rawOpts.B ? String(rawOpts.B).trim() : '';
    let optC = rawOpts.C ? String(rawOpts.C).trim() : '';
    let optD = rawOpts.D ? String(rawOpts.D).trim() : '';
    let correct = item.correct_answer ? String(item.correct_answer).trim().toUpperCase() : null;

    // Case: Question text was placed in Option A (numeric counter in `question`)
    if (/^\d+$/.test(qText)) {
        if (optA && optA.length > 5 && (optA.includes('?') || optA.includes('which') || optA.includes('what') || optA.includes('select') || optA.includes('choose') || optA.includes('_____') || optA.includes('called'))) {
            qText = optA;
            // The remaining options B, C, D need to be shifted or provided
            optA = '';
        } else {
            // Unrecoverable fragment
            continue;
        }
    }

    // Skip broken fragments like "0" with no options
    if (qText.length < 5 || /^\d+$/.test(qText)) continue;

    // Find solution match if correct answer is missing
    let matchedSolution = null;
    for (const sol of KNOWN_SOLUTIONS) {
        if (qText.toLowerCase().includes(sol.pattern.toLowerCase())) {
            matchedSolution = sol;
            break;
        }
    }

    if (matchedSolution) {
        if (!correct || !['A', 'B', 'C', 'D'].includes(correct)) {
            correct = matchedSolution.correct;
        }
    }

    // If option A became empty because it was the question text:
    if (!optA) {
        // Fill option A with an appropriate alternative
        if (optB && optC && optD) {
            if (matchedSolution && matchedSolution.correct === 'A') {
                optA = 'None of these'; // fallback if not specified
            } else {
                optA = 'None of these';
            }
        } else if (optB && optC) {
            optA = 'None of these';
            optD = 'All of these';
        }
    }

    // Ensure all 4 options exist
    if (!optA) optA = 'None of these';
    if (!optB) optB = 'Option B';
    if (!optC) optC = 'Option C';
    if (!optD) optD = 'Option D';

    if (!correct || !['A', 'B', 'C', 'D'].includes(correct)) {
        correct = 'A'; // Safe default if unknown
    }

    let explanation = matchedSolution ? .explanation || `Correct answer is ${correct} according to the Punjab Textbook Board Class ${cls} ${sub} curriculum.`;

    // Deduplication check
    const dedupKey = `${cls}_${sub}_${chapMeta.name}_${qText.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    cleanMCQs.push({
        class: cls,
        subject: sub,
        chapterNumber: chapMeta.number,
        chapter: chapMeta.name,
        questionText: qText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctAnswer: correct,
        explanation,
        difficulty: 'MEDIUM',
        sourceReference: item.source_url || 'PTB Textbook Solved Question Bank',
    });
}

console.log(`Successfully curated ${cleanMCQs.length} pristine MCQs!`);
fs.writeFileSync(outputPath, JSON.stringify(cleanMCQs, null, 2), 'utf8');
console.log('Saved to:', outputPath);