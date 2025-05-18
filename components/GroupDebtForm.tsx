import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AddGroupMember from './AddGroupMember';
import GroupMemberItem, { GroupMember } from './GroupMemberItem';
import GroupDebtSummary from './GroupDebtSummary';

interface GroupDebtFormProps {
  onCreateGroup: (
    groupName: string, 
    groupDescription: string, 
    members: Omit<GroupMember, 'id'>[]
  ) => Promise<void>;
  isLoading: boolean;
}

/**
 * Form component for creating group debts
 */
export default function GroupDebtForm({ onCreateGroup, isLoading }: GroupDebtFormProps) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  
  // Handle adding a new member
  const handleAddMember = (member: Omit<GroupMember, 'id'>) => {
    const newMember = {
      ...member,
      id: Date.now().toString()
    };
    
    setMembers([...members, newMember]);
    setShowAddMember(false);
  };
  
  // Handle editing an existing member
  const handleEditMember = (id: string) => {
    setEditingMemberId(id);
    setShowAddMember(true);
  };
  
  // Handle removing a member
  const handleRemoveMember = (id: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this person from the group?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setMembers(members.filter(m => m.id !== id))
        }
      ]
    );
  };
  
  // Handle updating member amount
  const handleAmountChange = (id: string, amount: string) => {
    setMembers(members.map(member => 
      member.id === id ? { ...member, amount } : member
    ));
  };
  
  // Validate form before submission
  const validateForm = () => {
    if (!groupName.trim()) {
      Alert.alert('Missing Information', 'Please enter a name for this debt group.');
      return false;
    }
    
    if (members.length === 0) {
      Alert.alert('No Members', 'Please add at least one person to the group.');
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      // Convert members to the format expected by the onCreateGroup function
      const memberData = members.map(({ id, ...rest }) => rest);
      
      await onCreateGroup(groupName, groupDescription, memberData);
      
      // Reset form after successful submission
      setGroupName('');
      setGroupDescription('');
      setMembers([]);
    } catch (error) {
      console.error('Error creating group debt:', error);
      Alert.alert('Error', 'There was a problem creating the group debt. Please try again.');
    }
  };
  
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Group Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Details</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter group name (e.g., Vacation Trip)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter description"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
        
        {/* Group Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Group Members</Text>
            <Text style={styles.memberCount}>({members.length})</Text>
          </View>
          
          {members.length > 0 && (
            <View style={styles.membersList}>
              {members.map(member => (
                <GroupMemberItem
                  key={member.id}
                  member={member}
                  onAmountChange={handleAmountChange}
                  onEdit={handleEditMember}
                  onRemove={handleRemoveMember}
                />
              ))}
            </View>
          )}
          
          <Pressable
            style={({pressed}) => [
              styles.addMemberButton,
              pressed && {opacity: 0.8}
            ]}
            onPress={() => {
              setEditingMemberId(null);
              setShowAddMember(true);
            }}
          >
            <Ionicons name="person-add" size={18} color="#000" />
            <Text style={styles.addMemberButtonText}>
              {members.length === 0 ? 'Add First Person' : 'Add Another Person'}
            </Text>
          </Pressable>
        </View>
        
        {/* Group Summary */}
        {members.length > 0 && (
          <GroupDebtSummary
            members={members}
            groupName={groupName}
          />
        )}
        
        {/* Create Button */}
        <Pressable
          style={({pressed}) => [
            styles.createButton,
            (pressed || isLoading) && {opacity: 0.8},
            members.length === 0 && styles.createButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={members.length === 0 || isLoading}
        >
          {isLoading ? (
            <Text style={styles.createButtonText}>Creating...</Text>
          ) : (
            <>
              <Ionicons name="layers" size={18} color="#000" style={styles.createButtonIcon} />
              <Text style={styles.createButtonText}>Create Group Debt</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
      
      {/* Add Member Modal */}
      <Modal
        visible={showAddMember}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <AddGroupMember
              onAdd={handleAddMember}
              onCancel={() => setShowAddMember(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(35,35,35,0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  memberCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    marginLeft: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  membersList: {
    marginBottom: 16,
  },
  addMemberButton: {
    backgroundColor: Colors.light.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  addMemberButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
  createButton: {
    backgroundColor: Colors.light.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(74, 226, 144, 0.3)',
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  createButtonIcon: {
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
  }
}); 