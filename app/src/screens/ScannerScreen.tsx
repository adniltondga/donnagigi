import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';
import { useTheme } from '@/contexts';
import { Button } from '@/components';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';

const BARCODE_TYPES: Array<
  | 'aztec'
  | 'ean13'
  | 'ean8'
  | 'qr'
  | 'pdf417'
  | 'upc_e'
  | 'datamatrix'
  | 'code39'
  | 'code93'
  | 'itf14'
  | 'codabar'
  | 'code128'
  | 'upc_a'
> = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'qr',
];

export default function ScannerScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScan = useCallback(
    (res: BarcodeScanningResult) => {
      if (lockRef.current || scanned) return;
      lockRef.current = true;
      setScanned(true);

      const data = res.data?.trim();
      if (!data) {
        lockRef.current = false;
        setScanned(false);
        return;
      }

      // Volta pra tela de produtos passando o barcode pra busca
      router.replace(
        `/produtos?barcode=${encodeURIComponent(data)}` as never,
      );
    },
    [router, scanned],
  );

  if (!permission) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.permissionBox}>
          <Ionicons
            name="camera-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
            Permissão da câmera
          </Text>
          <Text
            style={[
              styles.permissionDesc,
              { color: colors.textSecondary },
            ]}
          >
            Precisamos da câmera pra escanear códigos de barras dos produtos.
          </Text>
          <Button
            title={
              permission.canAskAgain
                ? 'Conceder acesso'
                : 'Abrir configurações do sistema'
            }
            onPress={() => {
              if (permission.canAskAgain) {
                void requestPermission();
              }
            }}
          />
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.cancel, { color: colors.textSecondary }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar style="light" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Aponte pro código</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.frameArea}>
          <View style={styles.frame}>
            <View
              style={[styles.corner, styles.cornerTL, { borderColor: '#fff' }]}
            />
            <View
              style={[styles.corner, styles.cornerTR, { borderColor: '#fff' }]}
            />
            <View
              style={[styles.corner, styles.cornerBL, { borderColor: '#fff' }]}
            />
            <View
              style={[styles.corner, styles.cornerBR, { borderColor: '#fff' }]}
            />
          </View>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.bottomText}>
            Centralize o código de barras dentro da moldura
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  permissionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  permissionDesc: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  cancel: { fontSize: FONT_SIZE.sm, marginTop: SPACING.md },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  topTitle: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  frameArea: { alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: BORDER_RADIUS.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: BORDER_RADIUS.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: BORDER_RADIUS.md,
  },
  bottomBar: { padding: SPACING.lg, alignItems: 'center' },
  bottomText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    opacity: 0.9,
  },
});
