import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Pressable 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';

export type DebtMode = 'single' | 'group';

interface DebtModeSelectorProps {
  selectedMode: DebtMode;
  onSelectMode: (mode: DebtMode) => void;
}

/**
 * A toggle component for switching between Single Debt and Group Debt modes
 */
export default function DebtModeSelector({ selectedMode, onSelectMode }: DebtModeSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.selector}>
        <Pressable
          style={({ pressed }) => [
            styles.option,
            selectedMode === 'single' && styles.selectedOption,
            pressed && styles.optionPressed
          ]}
          onPress={() => onSelectMode('single')}
        >
          <Text 
            style={[
              styles.optionText, 
              selectedMode === 'single' && styles.selectedOptionText
            ]}
          >
            Single Debt
          </Text>
        </Pressable>
        
        <Pressable
          style={({ pressed }) => [
            styles.option,
            selectedMode === 'group' && styles.selectedOption,
            pressed && styles.optionPressed
          ]}
          onPress={() => onSelectMode('group')}
        >
          <Text 
            style={[
              styles.optionText, 
              selectedMode === 'group' && styles.selectedOptionText
            ]}
          >
            Group Debt
          </Text>
        </Pressable>
      </View>
      
      <Text style={styles.helpText}>
        {selectedMode === 'single' 
          ? 'Track a debt owed by a single person'
          : 'Create multiple related debts in one go'
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  selector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30,30,30,0.8)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOption: {
    backgroundColor: Colors.light.tint,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontFamily: 'Aeonik-Black',
  },
  selectedOptionText: {
    color: '#000',
  },
  helpText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
    textAlign: 'center',
    fontStyle: 'italic',
  }
}); 