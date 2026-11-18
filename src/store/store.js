import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';

export const store = configureStore({
  reducer: { auth: authReducer },
});

export function homeFor(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'DOCTOR') return '/doctor';
  return '/manager';
}
