import { Router } from 'express';
import { generateChatResponse } from '../controllers/aiChat.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyStudentJWT } from '../middlewares/auth.student.middleware.js';

const router = Router();

// Route to generate chat response
router.post('/chat', verifyJWT, verifyStudentJWT, generateChatResponse);

export default router