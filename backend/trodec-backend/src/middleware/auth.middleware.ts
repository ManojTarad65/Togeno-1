import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '@/config/supabase';
import { ApiError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { AuthenticatedRequest, ProfileRow, toProfile, UserRole } from '@/types';

/**
 * Extract Bearer token from Authorization header
 */
export function extractToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
} 

/**
 * Middleware to authenticate requests using JWT token
 * Attaches user and profile to request object
 */
export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw ApiError.unauthorized('No authentication token provided');
    }

    // Verify token and get user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Token verification failed', { error: error?.message });
      throw ApiError.unauthorized('Invalid or expired token');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email!,
      createdAt: user.created_at,
    };

    // Fetch profile from database
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is ok for new users
      logger.error('Failed to fetch profile', { error: profileError.message });
      throw ApiError.internal('Failed to load user profile');
    }

    if (profileRow) {
      req.profile = toProfile(profileRow as ProfileRow);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific roles
 * Must be used after authenticate middleware
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!req.profile) {
      return next(ApiError.forbidden('Profile not found. Please complete registration.'));
    }

    if (!allowedRoles.includes(req.profile.role)) {
      logger.warn('Role access denied', {
        userId: req.user.id,
        userRole: req.profile.role,
        requiredRoles: allowedRoles
      });
      return next(ApiError.forbidden(`Access denied. Required role: ${allowedRoles.join(' or ')}`));
    }

    next();
  };
}

/**
 * Middleware to require verified expert status
 * Must be used after authenticate middleware
 */
export async function requireVerifiedExpert(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.profile || req.profile.role !== 'expert') {
      return next(ApiError.forbidden('Expert access required'));
    }

    const { data: expertRow, error } = await supabaseAdmin
      .from('expert_details')
      .select('is_verified')
      .eq('id', req.user!.id)
      .single();

    if (error || !expertRow) {
      return next(ApiError.forbidden('Expert profile not found'));
    }

    if (!expertRow?.is_verified) {
      return next(ApiError.forbidden('Your expert account is pending admin verification'));
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require verified brand status
 * Must be used after authenticate middleware
 */
export async function requireVerifiedBrand(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.profile || req.profile.role !== 'brand_admin') {
      return next(ApiError.forbidden('Brand admin access required'));
    }

    const { data: brandRow, error } = await supabaseAdmin
      .from('brand_details')
      .select('is_verified')
      .eq('id', req.user!.id)
      .single();

    if (error || !brandRow) {
      return next(ApiError.forbidden('Brand profile not found'));
    }

    if (!brandRow.is_verified) {
      return next(ApiError.forbidden('Your brand account is pending admin verification'));
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that behave differently for authenticated users
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email!,
        createdAt: user.created_at,
      };

      const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileRow) {
        req.profile = toProfile(profileRow as ProfileRow);
      }
    }

    next();
  } catch {
    // Silently continue without auth
    next();
  }
}
