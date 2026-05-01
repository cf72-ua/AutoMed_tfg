/**
 * Modelo de Paciente
 */

export interface CreatePatientProfileDto {
  userId: number;
  birthDate?: string;
  sex?: string;
  notes?: string;
  chronicFlags?: Record<string, boolean>;
}

export interface PatientProfileResponse {
  id: number;
  userId: number;
  birthDate?: string;
  sex?: string;
  notes?: string;
  chronicFlags?: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientWithUserResponse extends PatientProfileResponse {
  user: {
    id: number;
    email: string;
    fullName: string;
    phone?: string;
    status: string;
  };
}
