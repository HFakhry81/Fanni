import { ImageSourcePropType } from "react-native";
import iconElectricity from "@/assets/images/icon_electricity.webp";
import iconPlumbing from "@/assets/images/icon_plumbing.webp";
import iconAc from "@/assets/images/icon_ac.webp";
import iconCarpentry from "@/assets/images/icon_carpentry.webp";
import iconAppliances from "@/assets/images/icon_appliances.webp";
import iconPainting from "@/assets/images/icon_painting.webp";
import iconPest from "@/assets/images/icon_pest.webp";
import iconFlooring from "@/assets/images/icon_flooring.webp";

const CATEGORY_ICON_MAP: Record<string, ImageSourcePropType> = {
  electricity: iconElectricity,
  plumbing: iconPlumbing,
  ac: iconAc,
  carpentry: iconCarpentry,
  appliances: iconAppliances,
  painting: iconPainting,
  pest: iconPest,
  flooring: iconFlooring,
};

export default CATEGORY_ICON_MAP;
