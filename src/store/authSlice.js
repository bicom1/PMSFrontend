import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../services/api.js';
import { setAccessToken } from '../services/token.js';

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  const body = await api.post('/auth/refresh');
  return body.data;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null, status: 'idle' },
  reducers: {
    setSession(state, action) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
      setAccessToken(action.payload.accessToken);
    },
    clearSession(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
      setAccessToken(null);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
        setAccessToken(action.payload.accessToken);
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'anonymous';
        setAccessToken(null);
      });
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;
