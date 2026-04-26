import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

interface Domain {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string | null;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  governorate: string | null;
  area: string | null;
  profession: string | null;
  specialty: string | null;
  isAvailable: boolean;
  distanceM?: number;
}

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function BrowseTechniciansScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [loadingTechs, setLoadingTechs] = useState(false);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/categories/domains`)
      .then((r) => r.json())
      .then((d: { domains?: Domain[] }) => {
        if (d.domains) setDomains(d.domains);
      })
      .catch(() => {})
      .finally(() => setLoadingDomains(false));
  }, []);

  const fetchTechnicians = useCallback(
    (domainId: string | null) => {
      setLoadingTechs(true);
      const params = new URLSearchParams();
      if (domainId) params.set("domainId", domainId);
      const url = `${getApiBaseUrl()}/api/technicians/available?${params.toString()}`;
      fetch(url, {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      })
        .then((r) => r.json())
        .then((d: { technicians?: Technician[] }) => {
          setTechnicians(d.technicians ?? []);
        })
        .catch(() => setTechnicians([]))
        .finally(() => setLoadingTechs(false));
    },
    [sessionToken],
  );

  useEffect(() => {
    fetchTechnicians(selectedDomainId);
  }, [selectedDomainId, fetchTechnicians]);

  const handleChipPress = (domainId: string | null) => {
    setSelectedDomainId(domainId);
  };

  const renderTechCard = ({ item }: { item: Technician }) => {
    const initials = `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
    const fullName = `${item.firstName} ${item.lastName}`.trim();
    const locationParts = [item.governorate, item.area].filter(Boolean);
    const location = locationParts.join(", ");

    return (
      <View
        style={[
          styles.techCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary + "20" }]}>
          {item.profileImageUrl ? (
            <Image source={{ uri: item.profileImageUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarInitials, { color: colors.primary }]}>{initials}</Text>
          )}
        </View>
        <View style={[styles.techInfo, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <Text style={[styles.techName, { color: colors.foreground }]}>{fullName}</Text>
          {item.profession ? (
            <Text style={[styles.techProfession, { color: colors.primary }]}>{item.profession}</Text>
          ) : null}
          {location ? (
            <View style={[styles.locationRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <VectorIcon name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.techLocation, { color: colors.mutedForeground, marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }]}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
        {item.distanceM != null && (
          <View style={[styles.distanceBadge, { backgroundColor: colors.accentBlue }]}>
            <Text style={[styles.distanceText, { color: colors.secondary }]}>
              {formatDistance(item.distanceM)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "البحث عن فنيين" : "Browse Technicians"}
        showBack
        onBack={() => router.back()}
      />

      <View style={[styles.chipsWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          {loadingDomains ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 16 }} />
          ) : (
            <>
              <TouchableOpacity
                onPress={() => handleChipPress(null)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedDomainId === null ? colors.primary : colors.card,
                    borderColor: selectedDomainId === null ? colors.primary : colors.border,
                    borderRadius: 20,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selectedDomainId === null ? "#FFF" : colors.foreground },
                  ]}
                >
                  {isRTL ? "الكل" : "All"}
                </Text>
              </TouchableOpacity>
              {domains.map((d) => {
                const isActive = selectedDomainId === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => handleChipPress(d.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.card,
                        borderColor: isActive ? colors.primary : colors.border,
                        borderRadius: 20,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isActive ? "#FFF" : colors.foreground },
                      ]}
                    >
                      {isRTL ? d.nameAr : d.nameEn}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>

      {loadingTechs ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : technicians.length === 0 ? (
        <View style={styles.centered}>
          <VectorIcon name="users" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {isRTL ? "لا يوجد فنيون متاحون الآن" : "No technicians available right now"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={technicians}
          keyExtractor={(item) => item.id}
          renderItem={renderTechCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 100 : 90 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  chipsWrapper:  { borderBottomWidth: 1, paddingVertical: 10 },
  chipsRow:      { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  chip:          { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5 },
  chipText:      { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  listContent:   { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  techCard:      { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1.5, gap: 12 },
  avatarCircle:  { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarImage:   { width: 48, height: 48, borderRadius: 24 },
  avatarInitials:{ fontFamily: "Inter_700Bold", fontSize: 18 },
  techInfo:      { flex: 1, gap: 2 },
  techName:      { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  techProfession:{ fontFamily: "Inter_500Medium", fontSize: 12 },
  locationRow:   { alignItems: "center", gap: 4 },
  techLocation:  { fontFamily: "Inter_400Regular", fontSize: 12 },
  distanceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "center", flexShrink: 0 },
  distanceText:  { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  centered:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText:     { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", paddingHorizontal: 32 },
});
