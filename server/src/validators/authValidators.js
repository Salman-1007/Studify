import { z } from 'zod';

export const SUPPORTED_CLASSES = ['9', '10', '11', '12', 'MDCAT', 'ECAT'];
export const SUPPORTED_BOARDS = ['Punjab', 'Federal', 'Federal/FBISE', 'Sindh', 'KPK', 'PMDC', 'UET', 'National'];

export const signupSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().optional(),
    accountType: z.enum(['STUDENT', 'TEACHER']).optional().default('STUDENT'),
    teacherInviteCode: z.string().trim().optional(),
    class: z.union([z.string(), z.number()]).optional(),
    grade: z.union([z.string(), z.number()]).optional(),
    board: z.string().optional(),
    username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric').optional(),
    institution: z.string().optional(),
    educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).optional(),
}).transform((data) => {
    const accountType = data.accountType || 'STUDENT';
    let rawClass = data.class !== undefined ? String(data.class).trim() : (data.grade !== undefined ? String(data.grade).trim() : '');
    const upper = rawClass.toUpperCase();
    if (upper === 'MCAT' || upper === 'MDCAT') rawClass = 'MDCAT';
    else if (upper === 'ECAT') rawClass = 'ECAT';
    const board = data.board !== undefined ? data.board.trim() : (accountType === 'TEACHER' ? 'Punjab' : '');
    return {
        ...data,
        accountType,
        grade: rawClass || (accountType === 'TEACHER' ? '9' : ''),
        board,
    };
}).refine((data) => {
    if (data.accountType === 'TEACHER' && !data.grade) return true;
    return SUPPORTED_CLASSES.includes(data.grade);
}, {
    message: 'Class must be 9, 10, 11, 12, MDCAT, or ECAT',
    path: ['class'],
}).refine((data) => {
    if (data.accountType === 'TEACHER' && !data.board) return true;
    if (!data.board) return false;
    const norm = data.board.trim().toLowerCase();
    return SUPPORTED_BOARDS.some((b) => b.toLowerCase() === norm);
}, {
    message: 'Board must be Punjab, Federal/FBISE, Sindh, KPK, PMDC, or UET',
    path: ['board'],
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export const registerSchema = z.object({
    name: z.string().min(2, 'Name is too short'),
    username: z.string().min(3, 'Username is too short').regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).default('OTHER'),
    grade: z.string().optional(),
    board: z.string().optional(),
    institution: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export const loginSchema = z.object({
    identifier: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, 'Password is required'),
}).transform((data) => ({
    identifier: data.identifier || data.email || '',
    password: data.password,
})).refine((data) => data.identifier.length > 0, {
    message: 'Email or username is required',
    path: ['identifier'],
});

export const profileUpdateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    grade: z.union([z.string(), z.number()]).optional(),
    class: z.union([z.string(), z.number()]).optional(),
    board: z.string().optional(),
    institution: z.string().optional(),
    educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).optional(),
    themePreference: z.enum(['dark', 'light', 'system']).optional(),
    showOnlineStatus: z.boolean().optional(),
}).refine((data) => {
    const c = data.class !== undefined ? String(data.class) : (data.grade !== undefined ? String(data.grade) : undefined);
    if (c === undefined) return true;
    return SUPPORTED_CLASSES.includes(c);
}, {
    message: 'Class must be 9, 10, 11, or 12',
    path: ['class'],
}).refine((data) => {
    if (!data.board) return true;
    const norm = data.board.trim().toLowerCase();
    return SUPPORTED_BOARDS.some((b) => b.toLowerCase() === norm);
}, {
    message: 'Board must be Punjab, Federal/FBISE, Sindh, or KPK',
    path: ['board'],
});