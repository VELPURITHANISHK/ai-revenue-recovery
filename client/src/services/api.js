import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/recovery` : '/api/recovery';

export const getStats = () => axios.get(`${API_URL}/stats`);
export const getGlobalActivity = () => axios.get(`${API_URL}/activity`);
export const getFailedPayments = () => axios.get(`${API_URL}/failed-payments`);
export const getCases = () => axios.get(`${API_URL}/cases`);
export const getCaseDetail = (paymentId) => axios.get(`${API_URL}/cases/${paymentId}`);
export const getEscalations = () => axios.get(`${API_URL}/escalations`);
export const analyzePayment = (paymentId) => axios.post(`${API_URL}/${paymentId}/analyze`);
export const startRecovery = (paymentId) => axios.post(`${API_URL}/${paymentId}/start`);
export const stopRecovery = (paymentId) => axios.post(`${API_URL}/${paymentId}/stop`);
export const simulateSuccess = (paymentId) => axios.post(`${API_URL}/${paymentId}/simulate-success`);
export const getActivity = (paymentId) => axios.get(`${API_URL}/${paymentId}/activity`);
export const resetDemo = () => axios.post(`${API_URL}/reset-demo`);
