import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  joinByCodeSchema,
  submitAssignmentAttemptSchema,
} from '../validators/classroomValidators.js';
import * as clsCtrl from '../controllers/classroomController.js';
import * as teacherCtrl from '../controllers/teacherController.js';

const router = Router();
router.use(requireAuth);

router.get('/joined', clsCtrl.listJoinedClassrooms);
router.post('/join-by-code', validate(joinByCodeSchema), clsCtrl.joinByCode);
router.get('/invitations/:token/preview', clsCtrl.previewInvitation);
router.post('/invitations/:token/join', clsCtrl.joinByInvitationToken);

router.get('/assignments/:assignmentId', teacherCtrl.getAssignmentDetail);
router.post('/assignments/:assignmentId/start', teacherCtrl.startAssignmentAttempt);
router.post(
  '/assignments/:assignmentId/submit',
  validate(submitAssignmentAttemptSchema),
  teacherCtrl.submitAssignmentAttempt
);
router.get('/assignments/:assignmentId/leaderboard', teacherCtrl.getAssignmentLeaderboard);

router.get('/:id', clsCtrl.getClassroomDetail);
router.post('/:id/leave', clsCtrl.leaveClassroom);
router.get('/:id/members', clsCtrl.listClassroomMembers);
router.get('/:id/leaderboard', clsCtrl.getClassroomLeaderboard);

export default router;
