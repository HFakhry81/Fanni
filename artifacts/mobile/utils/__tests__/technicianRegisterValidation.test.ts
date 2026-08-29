import {
  getTechnicianIdPhotosError,
  hasRequiredTechnicianIdPhotos,
} from "../technicianRegisterValidation";

describe("technicianRegisterValidation", () => {
  it("requires both front and back photos", () => {
    expect(hasRequiredTechnicianIdPhotos(null, null)).toBe(false);
    expect(hasRequiredTechnicianIdPhotos("file:///a.jpg", null)).toBe(false);
    expect(hasRequiredTechnicianIdPhotos("file:///a.jpg", "file:///b.jpg")).toBe(true);
  });

  it("returns localized error when photos missing", () => {
    expect(getTechnicianIdPhotosError(null, null, true)).toMatch(/إجبارية/);
    expect(getTechnicianIdPhotosError("a", null, false)).toMatch(/required/i);
    expect(getTechnicianIdPhotosError("a", "b", false)).toBeUndefined();
  });
});
