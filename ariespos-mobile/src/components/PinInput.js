import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['⌫', '0', 'OK'],
];

export default function PinInput({ value, onChange, onSubmit, disabled }) {
  const handleKeyPress = (key) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === 'OK') {
      onSubmit();
      return;
    }
    if (value.length < 6) {
      onChange(`${value}${key}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View key={index} style={[styles.dot, index < value.length && styles.dotFilled]} />
        ))}
      </View>
      {KEYS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => handleKeyPress(key)}
              disabled={disabled}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
            >
              <Text style={styles.keyText}>{key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e3247',
    backgroundColor: '#1a1d27',
  },
  dotFilled: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  key: {
    width: '30%',
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  keyPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  keyText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
});
