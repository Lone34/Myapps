// src/api/profile.ts
import client from './client';

export interface RawProfileResponse {
  id?: number;
  name?: string;
  first_name?: string;
  email?: string;
  username?: string;
  phone_number?: string;
  age?: number | string | null;
  pan_card?: string | null;
  aadhaar?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  profile?: {
    phone_number?: string | null;
    age?: number | string | null;
    pan_card?: string | null;
    aadhaar?: string | null;
    avatar_url?: string | null;
  };
  token?: string;
  [key: string]: any;
}

/**
 * GET /api/users/profile/
 * Uses JWT/token via existing client config. Pure JSON.
 */
export const fetchProfile = async (): Promise<RawProfileResponse> => {
  const { data } = await client.get<RawProfileResponse>('/api/users/profile/');
  return data;
};

/**
 * PATCH /api/users/profile/
 * - Primary: DRF-style PATCH on /api/users/profile/
 * - Fallback: PUT /api/users/profile/update/ if PATCH/URL not enabled
 * No CSRF, token from client.
 */
export const saveProfileToBackend = async (
  payload: Partial<RawProfileResponse>
): Promise<RawProfileResponse> => {
  try {
    const { data } = await client.patch<RawProfileResponse>(
      '/api/users/profile/',
      payload
    );
    return data;
  } catch (error: any) {
    const status = error?.response?.status;

    // In case your backend only has /profile/update/ with PUT (current codebase)
    if (status === 404 || status === 405) {
      const { data } = await client.put<RawProfileResponse>(
        '/api/users/profile/update/',
        payload
      );
      return data;
    }

    throw error;
  }
};

/**
 * DELETE /api/users/profile/delete/
 * Used by "Delete Account" button.
 */
export const deleteProfileFromBackend = async (): Promise<void> => {
  await client.delete('/api/users/profile/delete/');
};

/**
 * Normalize backend response into flat fields the app expects.
 * Mirrors your web ProfilePage logic.
 */
export const normalizeProfile = (
  data: RawProfileResponse,
  userInfo?: any
) => {
  const profile = data?.profile || {};

  const fullName =
    data?.name ||
    data?.first_name ||
    userInfo?.name ||
    userInfo?.first_name ||
    '';

  const email =
    data?.email ||
    userInfo?.email ||
    data?.username ||
    '';

  const phone =
    data?.phone_number ||
    (profile as any)?.phone_number ||
    '';

  const age =
    (data as any)?.age ??
    (profile as any)?.age ??
    '';

  const pan =
    (data as any)?.pan_card ??
    (profile as any)?.pan_card ??
    '';

  const aadhaar =
    (data as any)?.aadhaar ??
    (profile as any)?.aadhaar ??
    '';

  const avatarUrl =
    data?.avatar_url ||
    (profile as any)?.avatar_url ||
    data?.avatar ||
    null;

  return { fullName, email, phone, age, pan, aadhaar, avatarUrl };
};

/**
 * Turn DRF-style error payloads into:
 * - fieldErrors: { [field]: 'message' }
 * - formError: generic / non_field_error
 */
export const extractProfileErrors = (error: any): {
  fieldErrors: Record<string, string>;
  formError: string;
} => {
  const fieldErrors: Record<string, string> = {};
  let formError = 'Something went wrong. Please try again.';

  const data = error?.response?.data;

  if (!data) {
    formError = error?.message || formError;
    return { fieldErrors, formError };
  }

  if (typeof data === 'string') {
    formError = data;
    return { fieldErrors, formError };
  }

  if (data.detail && typeof data.detail === 'string') {
    formError = data.detail;
  } else if (Array.isArray(data.non_field_errors)) {
    formError = data.non_field_errors.join(' ');
  } else {
    // Collect first error per field
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        fieldErrors[key] = String(value[0]);
      } else if (typeof value === 'string') {
        fieldErrors[key] = value;
      }
    });

    if (!Object.keys(fieldErrors).length && !formError) {
      formError = 'Please fix the highlighted fields.';
    }
  }

  return { fieldErrors, formError };
};
