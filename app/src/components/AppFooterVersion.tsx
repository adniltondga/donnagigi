import React, { useCallback } from 'react';
import { Alert, Text, type TextStyle, type StyleProp } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';

function showDetails() {
  const launch = __DEV__
    ? 'dev (Metro)'
    : Updates.isEmbeddedLaunch
    ? 'embedded (bundle do binário)'
    : 'OTA';
  const lines = [
    `Versão: ${APP_VERSION}`,
    `Runtime: ${Updates.runtimeVersion ?? '—'}`,
    `Canal: ${Updates.channel ?? '—'}`,
    `Origem: ${launch}`,
    `Update ID: ${Updates.updateId ?? '—'}`,
    `Criado em: ${
      Updates.createdAt ? Updates.createdAt.toISOString() : '—'
    }`,
  ];
  Alert.alert('AgLivre — info de build', lines.join('\n'), [{ text: 'OK' }]);
}

interface Props {
  style?: StyleProp<TextStyle>;
}

export function AppFooterVersion({ style }: Props) {
  const onLongPress = useCallback(() => {
    showDetails();
  }, []);

  return (
    <Text style={style} onLongPress={onLongPress} suppressHighlighting>
      AgLivre • v{APP_VERSION}
    </Text>
  );
}
