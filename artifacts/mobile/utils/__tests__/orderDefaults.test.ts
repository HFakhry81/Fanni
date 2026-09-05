import {
  currentTimeHhMm,
  defaultAddressFromUser,
  formatDateYmd,
  timePeriodLabel,
} from "../orderDefaults";

describe("orderDefaults", () => {
  it("formats today as YYYY-MM-DD", () => {
    expect(formatDateYmd(new Date("2026-08-29T12:00:00"))).toBe("2026-08-29");
  });

  it("formats current time as HH:mm", () => {
    expect(currentTimeHhMm(new Date("2026-08-29T09:05:00"))).toBe("09:05");
  });

  it("labels day vs night periods", () => {
    expect(timePeriodLabel("10:00", true)).toBe("نهاراً");
    expect(timePeriodLabel("21:00", true)).toBe("ليلاً");
    expect(timePeriodLabel("10:00", false)).toBe("Day");
  });

  it("builds address defaults from user profile", () => {
    const addr = defaultAddressFromUser(
      {
        id: "c1",
        type: "client",
        name: "Ali",
        mobile: "010",
        email: "a@b.com",
        governorate: "alexandria",
        governorateNameAr: "الإسكندرية",
        governorateNameEn: "Alexandria",
        area: "montaza",
        areaNameAr: "المنتزه",
        areaNameEn: "Montaza",
        street: "شارع واسع",
        buildingNo: "10",
        floorNo: "3",
        aptNo: "5",
        latitude: 31.2,
        longitude: 29.9,
      },
      true,
    );
    expect(addr.governorateId).toBe("alexandria");
    expect(addr.areaName).toBe("المنتزه");
    expect(addr.street).toBe("شارع واسع");
    expect(addr.buildingNo).toBe("10");
    expect(addr.floorNo).toBe("3");
    expect(addr.aptNo).toBe("5");
    expect(addr.latitude).toBe(31.2);
  });

  it("falls back to joined address string fields", () => {
    const addr = defaultAddressFromUser(
      {
        id: "c2",
        type: "client",
        name: "Sara",
        mobile: "011",
        email: "s@b.com",
        governorate: "cairo",
        area: "nasr_city",
        address: "شارع 9, Bldg: 12, Flr: 4, Apt: 8",
      },
      false,
    );
    expect(addr.street).toBe("شارع 9");
    expect(addr.buildingNo).toBe("12");
    expect(addr.floorNo).toBe("4");
    expect(addr.aptNo).toBe("8");
  });
});
