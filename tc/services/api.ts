import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const appConfigApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
const fallbackApiUrl = "http://10.58.194.141:8000/api/v1";

const API_URL = envApiUrl || appConfigApiUrl || fallbackApiUrl;

const api = axios.create({
    baseURL: API_URL,
    timeout: 15000
});

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROLE_KEY = "role";

type AuthRole = "student" | "user";

const clearStoredAuth = async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ROLE_KEY);
    await SecureStore.deleteItemAsync("user");
};

const getRefreshEndpoint = (role: AuthRole) => {
    return role === "student" ? "/students/refresh-token" : "/users/refresh-token";
};

api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let refreshPromise: Promise<string> | null = null;

const refreshAuthToken = async (): Promise<string> => {
    const role = await SecureStore.getItemAsync(ROLE_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if ((role !== "student" && role !== "user") || !refreshToken) {
        throw new Error("No refresh session available");
    }

    const response = await api.post(getRefreshEndpoint(role), { refreshToken });

    if (!response?.data?.success || !response?.data?.data?.accessToken) {
        throw new Error(response?.data?.message || "Token refresh failed");
    }

    const newAccessToken = response.data.data.accessToken as string;
    const newRefreshToken = (response.data.data.refreshToken as string | undefined) || refreshToken;

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newAccessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);

    return newAccessToken;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config as any;
        const requestUrl = String(originalRequest?.url || "");
        const isRefreshCall =
            requestUrl.includes("/users/refresh-token") ||
            requestUrl.includes("/users/refreshToken") ||
            requestUrl.includes("/students/refresh-token");

        if (status !== 401 || !originalRequest || originalRequest._retry || isRefreshCall) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = refreshAuthToken().finally(() => {
                    refreshPromise = null;
                });
            }

            const newAccessToken = await refreshPromise;
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            await clearStoredAuth();
            return Promise.reject(refreshError);
        }
    }
);

// --- Auth & Profile ---
export const loginStudent = (mobile: string, password: string) =>
    api.post("/students/login", { mobile, password });
export const refreshStudentToken = (refreshToken: string) =>
    api.post("/students/refresh-token", { refreshToken });

export const logoutStudent = () => api.post("/students/logout");
export const getStudentProfile = () => api.get("/students/profile");

export const loginUser = (mobile: string, password: string) =>
    api.post("/users/login", { mobile, password });
export const refreshUserToken = (refreshToken: string) =>
    api.post("/users/refresh-token", { refreshToken });

export const logoutUser = () => api.post("/users/logout");
export const getUserProfile = () => api.get("/users/profile");
export const registerUser = (data: { name: string; email: string; mobile: string; password: string }) =>
    api.post("/users/register", data);

// --- Batches ---
export const createBatch = (name: string) => api.post("/users/create/batch", { name });
export const getAllBatches = () => api.get("/users/get/all/batches");
export const updateBatchName = (batchId: string, newName: string) =>
    api.patch("/users/change/batch/changeName", { batchId, newName });
export const deleteBatch = (batchId: string) => api.delete("/users/delete/batch", { data: { batchId } });

// --- Students ---
export const registerStudent = (studentData: any) => api.post("/users/registerStudent", studentData);
export const getAllStudents = () => api.get("/users/get/all/students");
export const deleteStudent = (studentId: string) => api.delete("/users/deleteStudent", { data: { studentId } });
export const changeStudentBatch = (studentId: string, newBatchId: string, newSubjectIds: string[]) =>
    api.patch("/users/change/student/changeBatch", { studentId, newBatchId, newSubjectIds });
export const getAllStudentsOfBatch = (batchId: string) =>
    api.get("/users/get/all/students/of/batch", { params: { batchId } });

// --- Subjects ---
export const createSubject = (name: string, batchId: string) => api.post("/users/create/subject", { name, batchId });
export const getAllSubjectsOfBatch = (batchId: string) =>
    api.get("/users/get/all/subjects/of/batch", { params: { batchId } });
export const updateSubjectName = (subjectId: string, newName: string) =>
    api.patch("/users/change/subject/changeName", { subjectId, newName });
export const deleteSubjectFromBatch = (subjectId: string) =>
    api.delete("/users/delete/subject", { data: { subjectId } });
export const addStudentToSubject = (subjectId: string, studentId: string) =>
    api.post("/users/add/student/to/subject", { subjectId, studentId });
export const getAllStudentsOfSubject = (subjectId: string) =>
    api.get("/users/get/all/students/of/subject", { params: { subjectId } });

// --- Units ---
export const addUnitToSubject = (subjectId: string, unitName: string) =>
    api.post("/users/add/unit", { subjectId, unitName });
export const getAllUnitsOfSubject = (subjectId: string) =>
    api.get("/users/get/all/units/of/subject", { params: { subjectId } });
export const updateUnitName = (unitId: string, newName: string) =>
    api.patch("/users/change/unit/changeName", { unitId, newName });
export const deleteUnitFromSubject = (unitId: string) =>
    api.delete("/users/delete/unit", { data: { unitId } });

// --- Materials ---
export const generateUploadUrl = (fileName: string, unitId: string) =>
    api.post("/materials/upload-url", { fileName, unitId });
export const createMaterial = (title: string, unitId: string, fileKey: string, fileType: string) =>
    api.post("/materials", { title, unitId, fileKey, fileType });
export const getMaterialsByUnit = (unitId: string) =>
    api.get(`/materials/unit/${unitId}`);
export const deleteMaterial = (materialId: string) => api.delete(`/materials/${materialId}`);
export const getMaterialDownloadUrl = (materialId: string) => api.get(`/materials/download/${materialId}`);

// --- Attendance ---
export const createAttendance = (subjectId: string, batchId: string, date: string) =>
    api.post("/attendance/create", { subjectId, batchId, date });
export const markAttendance = (attendanceId: string, attendanceEntries: any[]) =>
    api.post("/attendance/mark", { attendanceId, attendanceEntries });
export const getAttendanceById = (attendanceId: string) =>
    api.get("/attendance/attendance", { params: { attendanceId } });
export const getAllAttendance = (params: any) => api.get("/attendance/list", { params });
export const updateAttendanceEntry = (attendanceId: string, studentId: string, status: string) =>
    api.patch("/attendance/update-entry", { attendanceId, studentId, status });
export const deleteAttendance = (attendanceId: string) => api.delete("/attendance/delete", { data: { attendanceId } });
export const getAttendanceReport = (params: any) => api.get("/attendance/report", { params });

export default api;
