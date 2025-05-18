import React from 'react';
import {
  StyleSheet,
  View,
  Text
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { GroupMember } from './GroupMemberItem';

interface GroupDebtSummaryProps {
  members: GroupMember[];
  groupName: string;
}

/**
 * Component for displaying a summary of group debts
 */
export default function GroupDebtSummary({ members, groupName }: GroupDebtSummaryProps) {
  // Calculate total amount from all members
  const totalAmount = members.reduce((sum, member) => {
    const amount = parseFloat(member.amount) || 0;
    return sum + amount;
  }, 0);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="layers-outline" size={20} color={Colors.light.tint} />
        <Text style={styles.title}>Group Summary</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Group Name:</Text>
          <Text style={styles.value}>{groupName || 'Unnamed Group'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Members:</Text>
          <Text style={styles.value}>{members.length}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Total Amount:</Text>
          <Text style={styles.value}>${totalAmount.toFixed(2)}</Text>
        </View>
        
        {members.length > 0 && (
          <View style={styles.membersList}>
            <Text style={styles.membersListTitle}>Member Debts:</Text>
            {members.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                <Text style={styles.memberAmount}>${parseFloat(member.amount || '0').toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(40,40,40,0.8)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(50,50,50,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
  content: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  value: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
  membersList: {
    marginTop: 12,
  },
  membersListTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  memberName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    flex: 1,
    marginRight: 8,
  },
  memberAmount: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  }
}); 