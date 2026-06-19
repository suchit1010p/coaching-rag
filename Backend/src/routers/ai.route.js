import { Router } from 'express';
import { generateChatResponse } from '../controllers/aiChat.controller.js';
import { verifyUserOrStudent } from '../middlewares/auth.unified.middleware.js';

const router = Router();

// Route to generate chat response
router.post('/chat', verifyUserOrStudent, generateChatResponse);

export default router
