import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import * as qCtrl from '../controllers/adminQuestionController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Platform & User Management
router.get('/users', ctrl.listUsers);
router.patch('/users/:id/deactivate', ctrl.deactivateUser);
router.get('/teachers', ctrl.listPendingTeachers);
router.patch('/teachers/:id/approve', ctrl.approveTeacher);
router.patch('/teachers/:id/reject', ctrl.rejectTeacher);
router.get('/teacher-invites', ctrl.listTeacherInviteCodes);
router.post('/teacher-invites', ctrl.createTeacherInviteCode);
router.patch('/teacher-invites/:id/revoke', ctrl.revokeTeacherInviteCode);
router.get('/groups', ctrl.listGroups);
router.get('/stats', ctrl.platformStats);

// Materials & Chat Audits
router.get('/materials', ctrl.listMaterialsAudit);
router.delete('/materials/:id', ctrl.deleteMaterial);
router.get('/chats-audit', ctrl.listChatsAudit);

// Canonical Question Bank Management
router.get('/questions', qCtrl.listQuestions);
router.get('/questions/:id', qCtrl.getQuestion);
router.post('/questions', qCtrl.createQuestion);
router.patch('/questions/:id', qCtrl.updateQuestion);
router.patch('/questions/:id/status', qCtrl.updateQuestion);
router.delete('/questions/:id', qCtrl.deleteQuestion);
router.post('/questions/import', qCtrl.importQuestions);
router.post('/questions/import-json', qCtrl.importQuestions);

export default router;