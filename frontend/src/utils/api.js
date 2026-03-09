import axios from 'axios';

// Throw an error during development if the API URL is not set.
// This prevents runtime errors and makes configuration issues obvious.
if (process.env.NODE_ENV === 'development' && !process.env.REACT_APP_API_URL) {
  throw new Error('REACT_APP_API_URL is not defined. Please create a .env.development file and set it.');
}

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Use an interceptor to dynamically add the token to every request.
// This ensures that the token is always up-to-date, even after a user logs in
// without a page refresh.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;