import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createClassroomSchema,
  updateClassroomSchema,
  createInvitationSchema,
  createAnnouncementSchema,
  updateTeacherQuizSchema,
  assignQuizSchema,
} from '../validators/classroomValidators.js';
import * as clsCtrl from '../controllers/classroomController.js';
import * as teacherCtrl from '../controllers/teacherController.js';

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth, requireTeacher);

router.get('/dashboard', teacherCtrl.getTeacherDashboard);
router.get('/analytics', teacherCtrl.getTeacherAnalytics);

router.get('/classrooms', clsCtrl.listTeacherClassrooms);
router.post('/classrooms', validate(createClassroomSchema), clsCtrl.createClassroom);
router.patch('/classrooms/:id', validate(updateClassroomSchema), clsCtrl.updateClassroom);
router.post('/classrooms/:id/regenerate-code', clsCtrl.regenerateJoinCode);
router.delete('/classrooms/:id/members/:userId', clsCtrl.removeStudentFromClassroom);

router.get('/classrooms/:id/invitations', clsCtrl.listInvitations);
router.post(
  '/classrooms/:id/invitations',
  validate(createInvitationSchema),
  clsCtrl.createInvitation
);
router.patch('/classrooms/:id/invitations/:invitationId/revoke', clsCtrl.revokeInvitation);

router.post(
  '/classrooms/:id/announcements',
  validate(createAnnouncementSchema),
  clsCtrl.createAnnouncement
);
router.patch('/classrooms/:id/announcements/:announcementId/pin', clsCtrl.togglePinAnnouncement);
router.delete('/classrooms/:id/announcements/:announcementId', clsCtrl.deleteAnnouncement);

router.get('/quizzes', teacherCtrl.listTeacherQuizzes);
router.post('/quizzes', teacherCtrl.createTeacherQuizManual);
router.post('/quizzes/generate-from-bank', teacherCtrl.generateTeacherQuizFromBank);
router.post(
  '/quizzes/generate-from-notes',
  upload.single('file'),
  teacherCtrl.generateTeacherQuizFromNotes
);
router.get('/quizzes/:id', teacherCtrl.getTeacherQuiz);
router.put('/quizzes/:id', validate(updateTeacherQuizSchema), teacherCtrl.updateTeacherQuiz);
router.delete('/quizzes/:id', teacherCtrl.deleteTeacherQuiz);
router.post('/quizzes/:id/assign', validate(assignQuizSchema), teacherCtrl.assignQuizToClassrooms);

router.patch('/assignments/:assignmentId/status', teacherCtrl.updateAssignmentStatus);
router.get('/assignments/:assignmentId', teacherCtrl.getAssignmentDetail);

export default router;
