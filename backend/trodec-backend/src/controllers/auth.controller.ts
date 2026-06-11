import { Request, Response, NextFunction } from "express";
import { authService } from "@/services/auth.service";
import { userService } from "@/services/user.service";
import { sendSuccess } from "@/utils/response";
import { ApiError } from "@/utils/errors";
import { SignUpInput, SignInInput, ChangePasswordInput } from "@/schemas";
import { extractToken } from "@/middleware/auth.middleware";
import { supabase, supabaseAdmin } from "@/config";
import { AuthenticatedRequest } from "@/types";

class AuthController {
  /**
   * POST /auth/signup
   * Register a new user with email/password and create profile
   */
  async signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Body is already validated by middleware
      const data = req.body as SignUpInput;

      // Create auth user
      const authResult = await authService.signUp({
        email: data.email,
        password: data.password,
      });

      // Create profile with role-specific details
      const profile = await userService.createProfile({
        userId: authResult.user.id,
        email: authResult.user.email,
        role: data.role,
        fullName: data.fullName,
        expertise: data.expertise,
        linkedinUrl: data.linkedinUrl,
        brandName: data.brandName,
      });

      sendSuccess(
        res,
        {
          user: authResult.user,
          profile,
          session: authResult.session,
        },
        201,
        "User registered successfully",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/signin
   * Sign in with email/password
   */
  async signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Body is already validated by middleware
      const data = req.body as SignInInput;

      const authResult = await authService.signIn({
        email: data.email,
        password: data.password,
      });

      // Fetch user profile
      const profile = await userService.getProfile(authResult.user.id);

      if (profile && !profile.isActive) {
        throw ApiError.unauthorized('Your account has been deactivated. Please contact support.');
      }

      sendSuccess(
        res,
        {
          user: authResult.user,
          profile,
          session: authResult.session,
        },
        200,
        "Signed in successfully",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/google
   * Get Google OAuth URL - frontend redirects user to this URL
   */
  async googleOAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { redirectTo } = req.query;

      if (!redirectTo || typeof redirectTo !== "string") {
        throw ApiError.badRequest("redirectTo query parameter is required");
      }

      const result = await authService.getGoogleOAuthUrl(redirectTo);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/signout
   * Sign out the current user
   */
  async signOut(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const accessToken = extractToken(req);

      if (!accessToken) {
        throw ApiError.unauthorized("No access token provided");
      }

      await authService.signOut(accessToken);
      sendSuccess(res, null, 200, "Signed out successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/refresh
   * Refresh the access token
   */
  async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw ApiError.badRequest("Refresh token is required");
      }

      const result = await authService.refreshToken(refreshToken);

      const profile = await userService.getProfile(result.user.id);
      if (profile && !profile.isActive) {
        throw ApiError.unauthorized('Your account has been deactivated. Please contact support.');
      }

      sendSuccess(res, result, 200, "Token refreshed successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/oauth/complete
   * Complete OAuth flow - create profile if it doesn't exist
   * Called by frontend after OAuth callback receives tokens
   */
  async completeOAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const accessToken = extractToken(req);

      if (!accessToken) {
        throw ApiError.unauthorized("No access token provided");
      }

      // Verify token and get user info
      const user = await authService.verifyToken(accessToken);

      // Check if profile exists
      let profile = await userService.getProfile(user.id);

      if (profile && !profile.isActive) {
        throw ApiError.unauthorized('Your account has been deactivated. Please contact support.');
      }

      // Only used when creating a brand-new profile. For an existing user we
      // keep the role already stored in `profiles` — never silently switch it
      // based on which login tab the user happened to click.
      const requestedRole = req.body?.role;
      const allowedRoles = ["consumer", "expert", "brand_admin"] as const;
      const isValidRole = (r: unknown): r is typeof allowedRoles[number] =>
        typeof r === "string" && (allowedRoles as readonly string[]).includes(r);

      if (!profile) {
        profile = await userService.createProfile({
          userId: user.id,
          email: user.email,
          role: isValidRole(requestedRole) ? requestedRole : "consumer",
          fullName: user.email.split("@")[0], // Use email prefix as default name
        });
      }

      // Get role-specific details
      const result = await userService.getUserWithProfile(user);

      sendSuccess(res, result, 200, "OAuth completed successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /auth/change-password
   * Change the authenticated user's password (verifies current password first)
   */
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as ChangePasswordInput;
      const userId = req.user!.id;
      const email = req.user!.email;

      // Verify current password by attempting sign-in
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyError) {
        throw ApiError.badRequest('Current password is incorrect');
      }

      // Update password via admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (updateError) {
        throw ApiError.internal('Failed to update password');
      }

      sendSuccess(res, {}, 200, 'Password updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
