import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mathplay-sync',
    mode: 'cloud',
    time: new Date().toISOString()
  });
});

app.post('/api/students', (req, res) => {
  try {
    const student = store.getOrCreateStudent(req.body || {});
    res.json(student);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/students/:classCode/:studentNo', (req, res) => {
  const student = store.getStudent(req.params.classCode, req.params.studentNo);
  if (!student) return res.status(404).json({ error: 'not found' });
  res.json(student);
});

app.get('/api/classes/:classCode/overview', (req, res) => {
  res.json(store.classOverview(req.params.classCode));
});

app.get('/api/schedules/:gradeId', (req, res) => {
  res.json(store.getSchedule(req.params.gradeId) || null);
});

app.put('/api/schedules/:gradeId', (req, res) => {
  const result = store.setSchedule(req.params.gradeId, req.body?.rows || []);
  res.status(result.ok ? 200 : 400).json(result);
});

app.get('/api/practice', (req, res) => {
  res.json(store.listPractice({
    gradeId: req.query.gradeId,
    topicId: req.query.topicId,
    goalId: req.query.goalId,
    categoryId: req.query.categoryId
  }));
});

app.post('/api/practice', (req, res) => {
  const result = store.addPracticeItem(req.body || {});
  res.status(result.ok ? 201 : 400).json(result);
});

app.post('/api/sessions', (req, res) => {
  try {
    const session = store.createSession(req.body || {});
    res.status(201).json(session);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/sessions/:sessionId/questions', (req, res) => {
  res.json(store.getSessionQuestions(req.params.sessionId));
});

app.post('/api/attempts/:attemptId/answer', (req, res) => {
  const { studentAnswer, correct } = req.body || {};
  const result = store.answerAttempt(req.params.attemptId, studentAnswer, correct);
  if (!result) return res.status(404).json({ error: 'attempt not found' });
  res.json(result);
});

app.get('/api/students-by-id/:studentId/sessions', (req, res) => {
  res.json(store.getStudentSessions(req.params.studentId));
});

app.get('/api/export', (_req, res) => {
  res.json(store.exportSnapshot());
});

// 靜態前端
app.use(express.static(ROOT, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MathPlay sync server http://127.0.0.1:${PORT}`);
});
