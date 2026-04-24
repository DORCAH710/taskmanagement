import axios from 'axios';
import { User, Task, AuthResponse, TaskListResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthResponse> => api.post('/auth/register', userData).then(res => res.data),

  login: (credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => api.post('/auth/login', credentials).then(res => res.data),

  getMe: (): Promise<User> => api.get('/auth/me').then(res => res.data),
};


export const userAPI = {
  getUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ users: User[]; totalPages: number; currentPage: number; total: number }> =>
    api.get('/users', { params }).then(res => res.data),

  getUser: (id: string): Promise<User> => api.get(`/users/${id}`).then(res => res.data),

  updateUser: (id: string, userData: {
    firstName?: string;
    lastName?: string;
    username?: string;
  }): Promise<User> => api.put(`/users/${id}`, userData).then(res => res.data),
};

// WebSocket connection for real-time features
export const socketAPI = {
  connect: () => {
    const socket = new WebSocket('ws://localhost:5001');
    return socket;
  },

  subscribeToTasks: (userId: string, callback: (payload: any) => void) => {
    const socket = socketAPI.connect();
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'task-update' && data.userId === userId) {
        callback(data.payload);
      }
    };
    return socket;
  }
};

// Enhanced task API with professional features
export const taskAPI = {
  // Basic CRUD operations
  getTasks: (params?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }): Promise<TaskListResponse> => api.get('/tasks', { params }).then(res => res.data),

  getMyTasks: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<TaskListResponse> => api.get('/tasks/my-tasks', { params }).then(res => res.data),

  getTask: (id: string): Promise<Task> => api.get(`/tasks/${id}`).then(res => res.data),

  createTask: (taskData: {
    title: string;
    description: string;
    assignedTo: string;
    dueDate: string;
    priority?: string;
    tags?: string;
  }): Promise<Task> => api.post('/tasks', taskData).then(res => res.data),

  updateTask: (id: string, taskData: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    dueDate?: string;
  }): Promise<Task> => api.put(`/tasks/${id}`, taskData).then(res => res.data),

  deleteTask: (id: string): Promise<void> => api.delete(`/tasks/${id}`).then(res => res.data),

  addComment: (id: string, text: string): Promise<any> => 
    api.post(`/tasks/${id}/comments`, { text }).then(res => res.data),

  uploadFile: (id: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/tasks/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => res.data);
  },
  
  // Get task statistics
  getStats: (): Promise<any> => api.get('/tasks/stats').then(res => res.data),
  
  // Bulk update tasks
  bulkUpdate: (taskIds: string[], updates: any): Promise<any> => 
    api.put('/tasks/bulk', { taskIds, updates }).then(res => res.data),
  
  // Advanced search
  search: (params?: {
    q?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  }): Promise<any> => api.get('/tasks/search', { params }).then(res => res.data),
  
  // Export tasks
  exportTasks: (format: 'csv' | 'json' = 'json'): Promise<any> => 
    api.get(`/tasks/export?format=${format}`).then(res => res.data),
};

export default api;
