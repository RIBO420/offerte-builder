import { describe, it, expect, vi } from "vitest";
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  getUserFriendlyMessage,
  getMutationErrorMessage,
  withRetry,
} from "@/lib/error-handling";

describe("Custom Error Classes", () => {
  describe("AppError", () => {
    it("creates error with correct properties", () => {
      const error = new AppError("Test error", "TEST_CODE", 500, true);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("AppError");
    });

    it("defaults to statusCode 500 and isOperational true", () => {
      const error = new AppError("Test", "TEST");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });
  });

  describe("ValidationError", () => {
    it("creates validation error with field", () => {
      const error = new ValidationError("Invalid email", "email");
      expect(error.message).toBe("Invalid email");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe("email");
    });
  });

  describe("NotFoundError", () => {
    it("creates not found error with resource and id", () => {
      const error = new NotFoundError("Offerte", "123");
      expect(error.message).toBe("Offerte met ID 123 niet gevonden");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(404);
    });

    it("creates not found error without id", () => {
      const error = new NotFoundError("Offerte");
      expect(error.message).toBe("Offerte niet gevonden");
    });
  });

  describe("AuthenticationError", () => {
    it("creates authentication error with default message", () => {
      const error = new AuthenticationError();
      expect(error.message).toBe("Niet ingelogd");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("AuthorizationError", () => {
    it("creates authorization error with default message", () => {
      const error = new AuthorizationError();
      expect(error.message).toBe("Geen toegang");
      expect(error.statusCode).toBe(403);
    });
  });
});

describe("getUserFriendlyMessage", () => {
  it("returns message for ValidationError", () => {
    const error = new ValidationError("Email is verplicht");
    expect(getUserFriendlyMessage(error)).toBe("Email is verplicht");
  });

  it("returns message for NotFoundError", () => {
    const error = new NotFoundError("Offerte", "123");
    expect(getUserFriendlyMessage(error)).toBe("Offerte met ID 123 niet gevonden");
  });

  it("returns friendly message for AuthenticationError", () => {
    const error = new AuthenticationError();
    expect(getUserFriendlyMessage(error)).toBe("Je bent niet ingelogd. Log opnieuw in.");
  });

  it("returns friendly message for AuthorizationError", () => {
    const error = new AuthorizationError();
    expect(getUserFriendlyMessage(error)).toBe("Je hebt geen toegang tot deze functie.");
  });

  it("returns generic message for unknown errors", () => {
    const error = new Error("Random error");
    expect(getUserFriendlyMessage(error)).toBe(
      "Er is een onverwachte fout opgetreden. Probeer het later opnieuw."
    );
  });
});

describe("getMutationErrorMessage", () => {
  it("returns validation message for Convex validation errors", () => {
    const error = new Error("Validation failed");
    expect(getMutationErrorMessage(error)).toBe(
      "Ongeldige gegevens. Controleer de invoer."
    );
  });

  it("returns network message for network errors", () => {
    const error = new Error("network error");
    expect(getMutationErrorMessage(error)).toBe(
      "Netwerkfout. Controleer je internetverbinding."
    );
  });

  it("returns generic message for unknown errors", () => {
    const error = new Error("Unknown error");
    expect(getMutationErrorMessage(error)).toBe(
      "Er is een fout opgetreden. Probeer het later opnieuw."
    );
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const operation = vi.fn().mockResolvedValue("success");
    const result = await withRetry(operation);
    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    // Use small delay for faster tests
    const result = await withRetry(operation, { delayMs: 10 });
    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(
      withRetry(operation, { maxRetries: 2, delayMs: 10 })
    ).rejects.toThrow("fail");

    expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("respects shouldRetry option", async () => {
    const operation = vi.fn().mockRejectedValue(new ValidationError("Invalid"));

    await expect(
      withRetry(operation, {
        shouldRetry: (error) => !(error instanceof ValidationError),
      })
    ).rejects.toThrow("Invalid");

    expect(operation).toHaveBeenCalledTimes(1); // No retries
  });
});
