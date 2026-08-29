import { ImageSourcePropType } from "react-native";
import subElectricalWiring from "@/assets/images/sub_electrical_wiring.webp";
import subComputers from "@/assets/images/sub_computers.webp";
import subWashingMachine from "@/assets/images/sub_washing_machine.webp";
import subWaterHeater from "@/assets/images/sub_water_heater.webp";
import subAcRepair from "@/assets/images/sub_ac_repair.webp";
import subAcCleaning from "@/assets/images/sub_ac_cleaning.webp";
import subPipes from "@/assets/images/sub_pipes.webp";
import subSanitary from "@/assets/images/sub_sanitary.webp";
import subDoors from "@/assets/images/sub_doors.webp";
import subFurniture from "@/assets/images/sub_furniture.webp";
import subFridge from "@/assets/images/sub_fridge.webp";
import subDishwasher from "@/assets/images/sub_dishwasher.webp";
import subInteriorPaint from "@/assets/images/sub_interior_paint.webp";
import subExteriorPaint from "@/assets/images/sub_exterior_paint.webp";
import subInsects from "@/assets/images/sub_insects.webp";
import subRodents from "@/assets/images/sub_rodents.webp";
import subTiles from "@/assets/images/sub_tiles.webp";
import subParquet from "@/assets/images/sub_parquet.webp";

const SUB_IMAGE_MAP: Record<string, ImageSourcePropType> = {
  sub_electrical_wiring: subElectricalWiring,
  sub_computers: subComputers,
  sub_washing_machine: subWashingMachine,
  sub_water_heater: subWaterHeater,
  sub_ac_repair: subAcRepair,
  sub_ac_cleaning: subAcCleaning,
  sub_pipes: subPipes,
  sub_sanitary: subSanitary,
  sub_doors: subDoors,
  sub_furniture: subFurniture,
  sub_fridge: subFridge,
  sub_dishwasher: subDishwasher,
  sub_interior_paint: subInteriorPaint,
  sub_exterior_paint: subExteriorPaint,
  sub_insects: subInsects,
  sub_rodents: subRodents,
  sub_tiles: subTiles,
  sub_parquet: subParquet,
};

export default SUB_IMAGE_MAP;
