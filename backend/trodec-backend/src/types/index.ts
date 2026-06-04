// User roles
export type UserRole = 'consumer' | 'expert' | 'brand_admin' | 'admin';

// Base user from Supabase Auth
export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

// Profile stored in our database
export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Expert-specific details
export interface ExpertDetails {
  id: string;
  expertise: string[];
  linkedinUrl: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  isVerified: boolean;
  verificationDate: string | null;
  rating: number;
  totalReviews: number;
  clothingSizes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Brand-specific details
export interface BrandDetails {
  id: string;
  brandName: string;
  businessType: string | null;
  websiteUrl: string | null;
  description: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  verificationDate: string | null;
  // GST / billing fields
  gstNumber: string | null;
  businessName: string | null;
  registeredAddress: string | null;
  billingState: string | null;
  billingPincode: string | null;
  billingEmail: string | null;
  contactNumber: string | null;
  panNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

// Combined user with profile and role-specific details
export interface UserWithProfile extends AuthUser {
  profile: Profile | null;
  expertDetails?: ExpertDetails | null;
  brandDetails?: BrandDetails | null;
}

// Session data
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
}

// Auth response
export interface AuthResponse {
  user: AuthUser;
  profile: Profile | null;
  session: Session | null;
}

// Request with authenticated user
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  profile?: Profile;
}

// Database row types (snake_case from Supabase)
export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpertDetailsRow {
  id: string;
  expertise: string[];
  linkedin_url: string | null;
  bio: string | null;
  years_of_experience: number | null;
  is_verified: boolean;
  verification_date: string | null;
  rating: number;
  total_reviews: number;
  clothing_sizes: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface BrandDetailsRow {
  id: string;
  brand_name: string;
  business_type: string | null;
  website_url: string | null;
  description: string | null;
  logo_url: string | null;
  is_verified: boolean;
  verification_date: string | null;
  gst_number: string | null;
  business_name: string | null;
  registered_address: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  billing_email: string | null;
  contact_number: string | null;
  pan_number: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to convert snake_case to camelCase
export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toExpertDetails(row: ExpertDetailsRow): ExpertDetails {
  return {
    id: row.id,
    expertise: row.expertise,
    linkedinUrl: row.linkedin_url,
    bio: row.bio,
    yearsOfExperience: row.years_of_experience,
    isVerified: row.is_verified,
    verificationDate: row.verification_date,
    rating: Number(row.rating),
    totalReviews: row.total_reviews,
    clothingSizes: row.clothing_sizes ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBrandDetails(row: BrandDetailsRow): BrandDetails {
  return {
    id: row.id,
    brandName: row.brand_name,
    businessType: row.business_type,
    websiteUrl: row.website_url,
    description: row.description,
    logoUrl: row.logo_url,
    isVerified: row.is_verified,
    verificationDate: row.verification_date,
    gstNumber: row.gst_number ?? null,
    businessName: row.business_name ?? null,
    registeredAddress: row.registered_address ?? null,
    billingState: row.billing_state ?? null,
    billingPincode: row.billing_pincode ?? null,
    billingEmail: row.billing_email ?? null,
    contactNumber: row.contact_number ?? null,
    panNumber: row.pan_number ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
