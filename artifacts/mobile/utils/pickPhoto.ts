import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

export interface PickedAsset {
  uri: string;
  mimeType: string;
}

async function launchSource(
  source: "camera" | "library"
): Promise<ImagePicker.ImagePickerResult> {
  if (source === "camera") {
    return ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
    });
  }
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.75,
  });
}

export function pickPhotoWithSourceChooser(
  isRTL: boolean
): Promise<PickedAsset | null> {
  return new Promise((resolve) => {
    Alert.alert(
      isRTL ? "إضافة صورة" : "Add Photo",
      isRTL ? "اختر مصدر الصورة" : "Choose a source",
      [
        {
          text: isRTL ? "الكاميرا" : "Camera",
          onPress: async () => {
            const camPerm = await ImagePicker.requestCameraPermissionsAsync();
            if (!camPerm.granted) {
              Alert.alert(
                isRTL ? "لا يوجد إذن" : "Permission Required",
                isRTL
                  ? "يرجى السماح للتطبيق بالوصول إلى الكاميرا من الإعدادات."
                  : "Please allow camera access in your settings."
              );
              return resolve(null);
            }
            const result = await launchSource("camera");
            if (result.canceled || !result.assets[0]) return resolve(null);
            const asset = result.assets[0];
            resolve({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
          },
        },
        {
          text: isRTL ? "معرض الصور" : "Photo Library",
          onPress: async () => {
            const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!libPerm.granted) {
              Alert.alert(
                isRTL ? "لا يوجد إذن" : "Permission Required",
                isRTL
                  ? "يرجى السماح للتطبيق بالوصول إلى معرض الصور من الإعدادات."
                  : "Please allow photo library access in your settings."
              );
              return resolve(null);
            }
            const result = await launchSource("library");
            if (result.canceled || !result.assets[0]) return resolve(null);
            const asset = result.assets[0];
            resolve({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
          },
        },
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
          onPress: () => resolve(null),
        },
      ]
    );
  });
}
