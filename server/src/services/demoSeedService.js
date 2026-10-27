const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Department = require('../models/department');
const Student = require('../models/student');
const Supervisor = require('../models/supervisor');
const Examiner = require('../models/examiner');
const Workspace = require('../models/workspace');
const Ledger = require('../models/supervisionLedger');
const ChatPage = require('../models/chatPage');
const ChatRead = require('../models/chatRead');
async function seedDemo({ password }) {
  const db = mongoose.connection.db;
  if (!db || !/^[a-z][a-z0-9_]{0,50}_demo$/.test(db.databaseName)) throw new Error('Demo seeding requires a separate database name ending in _demo.');
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Demo password must be 12 or more characters, up to 72 bytes.');
  const existing = await db.collection('demoSetup').findOne({ _id: 'synoria.demo.v1' });
  if (existing?.status === 'complete') return { created: false, database: db.databaseName, ...existing.manifest };
  for (const collection of await db.listCollections({}, { nameOnly: true }).toArray()) if (!collection.name.startsWith('system.') && await db.collection(collection.name).findOne({}, { projection: { _id: 1 } })) throw new Error('Demo database is not empty. Choose a fresh _demo database; existing data will not be overwritten.');
  await db.collection('demoSetup').insertOne({ _id: 'synoria.demo.v1', status: 'building' });
  await Promise.all([Department, Student, Supervisor, Examiner, Workspace, Ledger, ChatPage, ChatRead].map(Model => Model.init()));
  const passwordHash = await bcrypt.hash(password, 12), id = () => new mongoose.Types.ObjectId();
  const now = new Date(), ago = days => new Date(now.getTime() - days * 86400000), later = days => new Date(now.getTime() + days * 86400000);
  const department = await Department.create({ resourcePeriod: { status: 'open', deadline: new Date(Date.now()+30*86400000), notice: 'Upload and update your project resources before the deadline.' }, proposalPeriod: { status: 'open', deadline: new Date(Date.now()+30*86400000), notice: 'Complete your project proposal before the deadline.' }, name: 'Computer Science & Engineering', university: 'Synoria Demo University', email: 'coordinator@demo.synoria.test', passwordHash });
  const supervisors = await Supervisor.create(['Dr Ayesha Rahman', 'Dr Farhan Ahmed'].map((name, index) => ({ department: department._id, name, email: `supervisor${index + 1}@demo.synoria.test`, phone: `+880170000001${index}`, designation: 'Associate Professor', researchInterests: index ? 'Software Engineering, Human Computer Interaction' : 'Machine Learning, Data Science', passwordHash })));
  const examiners = await Examiner.create(['Dr Nusrat Islam', 'Dr Kamal Hasan'].map((name, index) => ({ department: department._id, name, email: `examiner${index + 1}@demo.synoria.test`, phone: `+880170000002${index}`, designation: 'Professor', passwordHash })));
  const students = await Student.create(['Maya Akter', 'Samiul Islam', 'Nafisa Rahman', 'Rafi Hasan', 'Tania Sultana', 'Adnan Karim', 'Faria Ahmed', 'Imran Hossain'].map((name, index) => ({ department: department._id, name, email: `student${index + 1}@demo.synoria.test`, phone: `+880170000003${index}`, studentId: `CSE-2026-${String(index + 1).padStart(3, '0')}`, batch: '42', academicSession: '2022-2023', passwordHash })));
  const actor = (account, role) => ({ id: account._id, name: account.name, role });
  const definitions = [['Campus Accessibility Study', [0], 'draft'], ['Bangla Document Retrieval', [1], 'submitted'], ['Crop Disease Research', [2, 3], 'active'], ['Accessible Learning Platform', [4], 'ready'], ['River Water Quality Analysis', [5], 'scheduled'], ['Bangla Sign Language Recognition', [6, 7], 'archived']];
  const workspaces = [];
  for (const [name, team, stage] of definitions) {
    const members = team.map(index => students[index]);
    workspaces.push(await Workspace.create({ department: department._id, name, workType: 'thesis', leader: members[0]._id, members: members.map(item => item._id), status: stage === 'archived' ? 'archived' : stage === 'draft' ? 'draft' : 'submitted', isActive: stage !== 'archived', proposalDraft: { title: name, abstract: `A final-year study on ${name.toLowerCase()}, with reproducible experiments and documented evaluation.`, researchArea: 'Applied Computing', supervisorPreference: supervisors[0]._id, savedAt: ago(25) }, proposalVersions: stage === 'draft' ? [] : [{ version: 1, title: name, abstract: `A final-year study on ${name.toLowerCase()}, with reproducible experiments and documented evaluation.`, researchArea: 'Applied Computing', supervisorPreference: { id: supervisors[0]._id, name: supervisors[0].name, email: supervisors[0].email }, members: members.map(item => ({ id: item._id, name: item.name, studentId: item.studentId, email: item.email })), submittedBy: members[0]._id, submittedAt: ago(25) }], invitations: stage === 'draft' ? [{ student: students[7]._id, status: 'pending' }] : [] }));
  }
  const defenceNoticeId = id();
  const ledger = { _id: department._id, limits: supervisors.map(item => ({ supervisor: item._id, maxLoad: 5 })), assignments: [], history: [], reviews: [], defences: [], rubricVersions: [] };
  for (let index = 2; index < workspaces.length; index++) {
    const workspace = workspaces[index], owner = students[definitions[index][1][0]], supervisor = supervisors[index === 2 ? 0 : 1];
    ledger.assignments.push({ workspace: workspace._id, supervisor: supervisor._id, assignedAt: ago(24) });
    ledger.history.push({ workspace: workspace._id, from: null, to: { id: supervisor._id, name: supervisor.name }, actor: department._id, reason: 'Demo supervision allocation', createdAt: ago(24) });
    ledger.reviews.push({ workspace: workspace._id, version: 1, decision: 'approved', comment: 'The proposed scope is suitable for a final-year thesis.', reviewer: { id: supervisor._id, name: supervisor.name }, approvedScope: workspace.proposalVersions[0].toObject(), createdAt: ago(23) });
    if (index === 2) {
      await ChatPage.create({ department:department._id,workspace:workspace._id,page:0,messages:[{_id:id(),senderId:owner._id,senderRole:'student',senderName:owner.name,text:'Can we discuss the proposed research approach?',requestKey:randomUUID(),fingerprint:'demo',createdAt:ago(2)},{_id:id(),senderId:supervisor._id,senderRole:'supervisor',senderName:supervisor.name,text:'Yes. Compare the two approaches and share your findings here.',requestKey:randomUUID(),fingerprint:'demo',createdAt:ago(1)}] });
    }
    if (index < 4) continue;
    const startsAt = index === 5 ? ago(1) : later(7), defence = { _id: id(), workspace: workspace._id, workspaceName: workspace.name, title: workspace.name, workType: workspace.workType, noticeId: index === 4 ? defenceNoticeId : undefined, noticeRevision: index === 4 ? 0 : undefined, batch: index === 4 ? '42' : undefined, stream: index === 4 ? 'Thesis' : undefined, status: index === 5 ? 'published' : 'scheduled', revision: 0, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60000), durationMinutes: 30, venue: index === 5 ? 'CSE Archive Room' : 'CSE Seminar Room', venueKey: index === 5 ? 'cse archive room' : 'cse seminar room', meetingLink: '', linkKey: '', board: examiners.map(item => ({ id: item._id, name: item.name, designation: item.designation })), team: definitions[index][1].map(i => ({ id: students[i]._id, name: students[i].name, studentId: students[i].studentId })), proposalVersion: 1, proposalApprovedAt: ago(23), history: [], createdAt: ago(1), updatedAt: now };
    defence.history.push({ ...defence, history: undefined, _id: id(), type: 'scheduled', status: 'scheduled', version: 1, actor: { id: department._id, name: department.name }, createdAt: ago(1) });
    if (!ledger.rubricVersions.length) ledger.rubricVersions.push({ _id: id(), version: 1, name: 'Final-Year Thesis Rubric', description: 'Demonstration evaluation rubric.', criteria: [{ _id: id(), title: 'Research Quality', description: 'Methodology and evidence', maxMarks: 100, weight: 60 }, { _id: id(), title: 'Presentation And Viva', description: 'Clarity and understanding', maxMarks: 100, weight: 40 }], createdBy: actor(department, 'department'), createdAt: ago(2), requestKey: randomUUID() });
    const template = ledger.rubricVersions[0]; defence.evaluation = { revision: 1, rubric: { id: template._id, version: 1, name: template.name, description: template.description, criteria: template.criteria }, records: [], history: [], publication: null };
    if (index === 5) {
      defence.evaluation.records = examiners.map((examiner, i) => ({ _id: id(), examiner: actor(examiner, 'examiner'), revision: 1, status: 'submitted', scores: template.criteria.map(criterion => ({ criterionId: criterion._id, marks: i ? 84 : 80, comment: 'Clear methodology and well-documented results.' })), comment: 'A sound final-year thesis.', submittedAt: ago(1), updatedAt: ago(1), versions: [] }));
      defence.evaluation.publication = { ...require('./evaluationService').calculate(defence), rubric: defence.evaluation.rubric, note: 'Demonstration result: 82 / 100.', publishedBy: actor(department, 'department'), publishedAt: now };
      defence.history.push({ ...defence, evaluation: undefined, history: undefined, _id: id(), type: 'published', version: 2, actor: { id: department._id, name: department.name }, createdAt: now });
    }
    ledger.defences.push(defence);
  }
  await Ledger.create(ledger);
  await require('../models/defenceNotice').create({ _id: defenceNoticeId, department: department._id, batch: '42', stream: 'Thesis', startsAt: later(7), venue: 'CSE Seminar Room', requestKey: randomUUID() });
  const manifest = { accounts: { coordinator: department.email, supervisors: supervisors.map(item => item.email), examiners: examiners.map(item => item.email), students: students.map(item => item.email) }, projects: workspaces.map((item, index) => ({ id: item.id, name: item.name, stage: definitions[index][2] })) };
  await db.collection('demoSetup').updateOne({ _id: 'synoria.demo.v1' }, { $set: { status: 'complete', manifest, createdAt: now } });
  return { created: true, database: db.databaseName, ...manifest };
}
module.exports = { seedDemo };
