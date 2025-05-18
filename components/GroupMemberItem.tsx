import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export interface GroupMember {
  id: string;
  name: string;
  amount: string;
  phoneNumber?: string;
  description?: string;
}

interface GroupMemberItemProps {
  member: GroupMember;
  onAmountChange: (id: string, amount: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  showCurrency?: boolean;
}

/**
 * Component for displaying a single group member with their name and amount
 */
export default function GroupMemberItem({
  member,
  onAmountChange,
  onEdit,
  onRemove,
  showCurrency = true
}: GroupMemberItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.nameSection}>
        <Text style={styles.name}>{member.name}</Text>
        {member.phoneNumber && (
          <View style={styles.phoneContainer}>
            <Ionicons name="call-outline" size={12} color={Colors.light.tint} />
            <Text style={styles.phoneText} numberOfLines={1} ellipsizeMode="middle">
              {member.phoneNumber}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.amountSection}>
        <View style={styles.amountContainer}>
          {showCurrency && <Text style={styles.currencySymbol}>$</Text>}
          <TextInput
            style={styles.amountInput}
            value={member.amount}
            onChangeText={(value) => onAmountChange(member.id, value)}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="rgba(255,255,255,0.4)"
            selectTextOnFocus
          />
        </View>
        
        <View style={styles.actions}>
          <Pressable
            style={({pressed}) => [styles.actionButton, pressed && {opacity: 0.7}]}
            onPress={() => onEdit(member.id)}
          >
            <Ionicons name="pencil-outline" size={20} color={Colors.light.tint} />
          </Pressable>
          
          <Pressable
            style={({pressed}) => [styles.actionButton, pressed && {opacity: 0.7}]}
            onPress={() => onRemove(member.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#FF5A5A" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(40,40,40,0.8)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nameSection: {
    marginBottom: 8,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginBottom: 2,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  phoneText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
    marginLeft: 4,
    maxWidth: 180,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    flex: 1,
    marginRight: 10,
  },
  currencySymbol: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  }
}); 