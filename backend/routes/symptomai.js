// ============================================================
//  routes/symptomAI.js  —  Groq AI  (llama-3.1-8b-instant)
//  Two endpoints:
//    POST /api/ai/symptom-analysis  — symptom checker
//    POST /api/ai/health-assessment — AI Health Assistant
// ============================================================
const express = require('express');
const router  = express.Router();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.1-8b-instant';

// ── Siddha specialist mapping ─────────────────────────────────
const SPEC_MAP = [
  { keywords: ['pediatric','child','infant','neonatal','kuzhanthai'],                    spec: 'Kuzhanthai Maruthuvam'                  },
  { keywords: ['gynecolog','obstetric','maternity','pregnancy','antenatal','soolmagalir'],spec: 'Soolmagalir Maruthuvam'                 },
  { keywords: ['surgery','surgical','operative','aruvai'],                                spec: 'Aruvai Thol Maruthuvam'                 },
  { keywords: ['varma','varmam','neuro','neurolog','paralysis','stroke'],                 spec: 'Varma Pura Sirappu Maruthuvam'          },
  { keywords: ['emergency','avasara','acute','trauma','urgent'],                          spec: 'Avasara Maruthuvam'                     },
  { keywords: ['toxicolog','nanju','poison'],                                             spec: 'Nanju Noolum Maruthuva Neethi Noolum'  },
  { keywords: ['general','pothu','internal','fever','cold','cough','skin','digestive','respiratory','common'], spec: 'Pothu Maruthuvam' },
];

function mapToSpec(aiSpecialist = '') {
  const lower = aiSpecialist.toLowerCase();
  for (const { keywords, spec } of SPEC_MAP) {
    if (keywords.some(k => lower.includes(k))) return spec;
  }
  return 'Pothu Maruthuvam';
}

// ── Generic Groq caller ───────────────────────────────────────
async function callGroqAPI(prompt, systemMessage, temperature = 0.3, maxTokens = 1500) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set in .env');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user',   content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API ${response.status}: ${errText}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// ── Extract JSON from Groq response ──────────────────────────
function extractJSON(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try   { return JSON.parse(match[0]); }
  catch { return null; }
}

// ── Disease prediction ────────────────────────────────────────
async function predictDisease(symptoms, userInfo) {
  const symptomsText = symptoms.filter(Boolean)
    .map(s => `- ${s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}`)
    .join('\n');

  const prompt = `You are a senior clinical physician. Analyze the patient profile and symptoms to determine the single most probable disease.

Patient Profile:
- Age: ${userInfo.age}
- Gender: ${userInfo.gender}
- Known Past Conditions: ${userInfo.pastConditions}

Presenting Symptoms:
${symptomsText}

Instructions:
1. Identify the ONE most likely disease — be specific, never vague.
2. Write a clear 3-4 sentence clinical explanation.
3. Identify the most appropriate specialist type.
4. Rate urgency: Emergency, High, Moderate, or Low.
5. Provide a 1-2 sentence Siddha/Ayurvedic perspective.

Respond ONLY with valid JSON (no markdown):
{
  "disease_name": "Specific disease name",
  "explanation": "3-4 sentence clinical explanation",
  "recommended_specialist": "one of: General Physician, Pediatrician, Gynecologist/Obstetrician, Surgeon, Varma & Neurology Specialist, Emergency Medicine, Toxicologist",
  "urgency": "Emergency|High|Moderate|Low",
  "siddha_insight": "1-2 sentence Siddha/Ayurvedic perspective"
}`;

  const raw    = await callGroqAPI(prompt, 'You are a highly experienced clinical physician. Respond ONLY in valid JSON.', 0.1, 900);
  const parsed = extractJSON(raw);

  if (parsed) {
    return {
      disease:               parsed.disease_name           || 'Medical Consultation Required',
      explanation:           parsed.explanation            || 'Please consult a healthcare professional.',
      recommendedSpecialist: parsed.recommended_specialist || 'General Physician',
      urgency:               parsed.urgency                || 'Moderate',
      siddhaInsight:         parsed.siddha_insight         || '',
    };
  }
  return { disease: 'Medical Consultation Required', explanation: 'Please consult a healthcare professional.', recommendedSpecialist: 'General Physician', urgency: 'Moderate', siddhaInsight: '' };
}

// ── Health assessment ─────────────────────────────────────────
async function assessHealth(vitals) {
  const prompt = `You are an expert preventive healthcare physician. Analyze the patient's health vitals and return a detailed health assessment.

Patient Vitals:
- Age: ${vitals.age}
- Gender: ${vitals.gender}
- Blood Sugar (Fasting): ${vitals.bloodSugar} mg/dL
- Blood Pressure: ${vitals.bloodPressure} mmHg
- BMI: ${vitals.bmi}
- Heart Rate: ${vitals.heartRate} bpm
- Cholesterol: ${vitals.cholesterol} mg/dL
- Haemoglobin: ${vitals.haemoglobin} g/dL
- Sleep Hours per Night: ${vitals.sleepHours}
- Exercise Days per Week: ${vitals.exerciseDays}
- Smoking: ${vitals.smoking}
- Alcohol: ${vitals.alcohol}
- Known Conditions: ${vitals.knownConditions || 'None'}
- Current Symptoms: ${vitals.currentSymptoms || 'None'}

Instructions:
1. Compute an overall health score from 0–100 (100 = perfect health).
2. Break it down into 6 sub-scores (0–100 each): cardiovascular, metabolic, lifestyle, nutrition, mental_wellness, physical_fitness.
3. For each sub-score write a 1-sentence insight.
4. List up to 4 key risk factors identified.
5. List 4 personalized health improvement tips.
6. Give a single overall health status label: Excellent / Good / Fair / Poor / Critical.
7. Write a 2-3 sentence overall health summary.

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "overall_score": 0-100,
  "status": "Excellent|Good|Fair|Poor|Critical",
  "summary": "2-3 sentence overall health summary",
  "sub_scores": {
    "cardiovascular":   { "score": 0-100, "insight": "..." },
    "metabolic":        { "score": 0-100, "insight": "..." },
    "lifestyle":        { "score": 0-100, "insight": "..." },
    "nutrition":        { "score": 0-100, "insight": "..." },
    "mental_wellness":  { "score": 0-100, "insight": "..." },
    "physical_fitness": { "score": 0-100, "insight": "..." }
  },
  "risk_factors": ["risk1", "risk2", "risk3", "risk4"],
  "improvement_tips": ["tip1", "tip2", "tip3", "tip4"]
}`;

  const raw    = await callGroqAPI(prompt, 'You are an expert preventive healthcare physician. Analyze vitals accurately and respond ONLY in valid JSON.', 0.2, 1200);
  const parsed = extractJSON(raw);

  if (parsed) return parsed;

  // Fallback
  return {
    overall_score: 50,
    status: 'Fair',
    summary: 'Unable to complete full analysis. Please ensure all vitals are entered correctly and try again.',
    sub_scores: {
      cardiovascular:   { score: 50, insight: 'Unable to assess.' },
      metabolic:        { score: 50, insight: 'Unable to assess.' },
      lifestyle:        { score: 50, insight: 'Unable to assess.' },
      nutrition:        { score: 50, insight: 'Unable to assess.' },
      mental_wellness:  { score: 50, insight: 'Unable to assess.' },
      physical_fitness: { score: 50, insight: 'Unable to assess.' },
    },
    risk_factors:     ['Please consult a healthcare professional for accurate assessment.'],
    improvement_tips: ['Maintain a balanced diet', 'Exercise regularly', 'Get adequate sleep', 'Manage stress levels'],
  };
}

// ══════════════════════════════════════════════════════════════
//  POST /api/ai/symptom-analysis
// ══════════════════════════════════════════════════════════════
router.post('/symptom-analysis', async (req, res) => {
  const { symptoms, age, gender, pastConditions } = req.body;
  if (!symptoms || symptoms.trim().length < 5)
    return res.status(400).json({ error: 'Please describe your symptoms in more detail.' });
  if (!process.env.GROQ_API_KEY)
    return res.status(500).json({ error: 'AI service is not configured. Add GROQ_API_KEY to your .env file.' });

  const symptomList = symptoms.includes(',')
    ? symptoms.split(',').map(s => s.trim()).filter(Boolean)
    : [symptoms.trim()];

  const userInfo = { age: age || 'Not specified', gender: gender || 'Not specified', pastConditions: pastConditions || 'None' };

  try {
    const diseaseResult = await predictDisease(symptomList, userInfo);
    const mappedSpec    = mapToSpec(diseaseResult.recommendedSpecialist);

    const { Doctor } = require('../models');
    let doctors = await Doctor.find({ available: true, spec: { $regex: mappedSpec.split(' ')[0], $options: 'i' } })
      .select('_id name spec qual exp gender avatar onlineEnabled schedule regNo consultFee').limit(4);

    if (doctors.length === 0)
      doctors = await Doctor.find({ available: true, spec: /Pothu/i })
        .select('_id name spec qual exp gender avatar onlineEnabled schedule regNo consultFee').limit(3);

    return res.json({
      disease:               diseaseResult.disease,
      explanation:           diseaseResult.explanation,
      urgency:               diseaseResult.urgency,
      siddhaInsight:         diseaseResult.siddhaInsight,
      recommendedSpecialist: diseaseResult.recommendedSpecialist,
      mappedSpec,
      recommendedDoctors:    doctors,
    });

  } catch (err) {
    console.error('[Groq symptom]', err.message);
    return res.status(500).json({ error: 'AI service encountered an issue. Please try again.' });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/ai/health-assessment
// ══════════════════════════════════════════════════════════════
router.post('/health-assessment', async (req, res) => {
  const v = req.body;
  if (!v.age || !v.gender)
    return res.status(400).json({ error: 'Age and gender are required.' });
  if (!process.env.GROQ_API_KEY)
    return res.status(500).json({ error: 'AI service is not configured. Add GROQ_API_KEY to your .env file.' });

  try {
    const result = await assessHealth(v);
    return res.json(result);
  } catch (err) {
    console.error('[Groq health]', err.message);
    return res.status(500).json({ error: 'AI service encountered an issue. Please try again.' });
  }
});

module.exports = router;
