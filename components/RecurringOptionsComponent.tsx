import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Platform, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import { RecurringFrequency, RecurringOptions } from '@/firebase/models';

interface RecurringOptionsComponentProps {
  options: RecurringOptions;
  onChange: (options: RecurringOptions) => void;
}

const RecurringOptionsComponent: React.FC<RecurringOptionsComponentProps> = ({ 
  options, 
  onChange 
}) => {
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  
  // Temporary state for iOS date pickers
  const [tempStartDate, setTempStartDate] = useState<Date>(options.startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(options.endDate);
  
  // Function to handle frequency change
  const handleFrequencyChange = (frequency: RecurringFrequency) => {
    let updatedOptions = { ...options, frequency };
    
    // Set appropriate default day values based on frequency
    if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') {
      // Default to 1st of month
      updatedOptions.dayOfMonth = 1;
    } else if (frequency === 'weekly' || frequency === 'biweekly') {
      // Default to monday
      updatedOptions.dayOfWeek = 1; // Monday
    }
    
    onChange(updatedOptions);
    setShowFrequencyPicker(false);
  };
  
  // Function to handle start date change
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (!selectedDate) return;
    
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
      
      // Ensure end date is after start date
      let newEndDate = options.endDate;
      if (options.endDate && selectedDate > options.endDate) {
        newEndDate = null;
      }
      
      onChange({
        ...options,
        startDate: selectedDate,
        endDate: newEndDate
      });
    } else {
      // For iOS, store in temporary state
      setTempStartDate(selectedDate);
    }
  };
  
  // Function to handle end date change
  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (!selectedDate) return;
    
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
      
      // Create a new date instance to avoid reference issues
      const newEndDate = new Date(selectedDate.getTime());
      
      onChange({
        ...options,
        endDate: newEndDate
      });
    } else {
      // For iOS, store in temporary state
      setTempEndDate(selectedDate);
    }
  };
  
  // Function to confirm iOS date selection
  const confirmStartDate = () => {
    // Ensure end date is after start date
    let newEndDate = options.endDate;
    if (options.endDate && tempStartDate > options.endDate) {
      newEndDate = null;
    }
    
    onChange({
      ...options,
      startDate: tempStartDate,
      endDate: newEndDate
    });
    
    setShowStartDatePicker(false);
  };
  
  // Function to confirm iOS end date selection
  const confirmEndDate = () => {
    onChange({
      ...options,
      endDate: tempEndDate
    });
    
    setShowEndDatePicker(false);
  };
  
  // Function to open date pickers and initialize temp state
  const openStartDatePicker = () => {
    setTempStartDate(options.startDate);
    setShowStartDatePicker(true);
  };
  
  const openEndDatePicker = () => {
    setTempEndDate(options.endDate || new Date());
    setShowEndDatePicker(true);
  };
  
  // Function to handle day of month change
  const handleDayOfMonthChange = (day: number) => {
    onChange({
      ...options,
      dayOfMonth: day
    });
  };
  
  // Function to handle day of week change
  const handleDayOfWeekChange = (day: number) => {
    onChange({
      ...options,
      dayOfWeek: day
    });
  };
  
  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return 'Not specified';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  // Get day of week name
  const getDayOfWeekName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };
  
  // Determine if we should show day of month selector
  const showDayOfMonth = false;
  
  // Determine if we should show day of week selector
  const showDayOfWeek = options.isRecurring && 
    (options.frequency === 'weekly' || options.frequency === 'biweekly');
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.labelContainer}>
          <Ionicons name="refresh" size={18} color={Colors.light.tint} style={styles.labelIcon} />
          <ThemedText style={styles.label}>Make this a recurring debt</ThemedText>
        </View>
        <Pressable
          style={styles.toggleButton}
          onPress={() => onChange({ ...options, isRecurring: !options.isRecurring })}
        >
          <View style={[
            styles.toggleTrack,
            options.isRecurring && styles.toggleTrackActive
          ]}>
            <View style={[
              styles.toggleThumb,
              options.isRecurring && styles.toggleThumbActive
            ]} />
          </View>
        </Pressable>
      </View>
      
      {options.isRecurring && (
        <View style={styles.optionsContainer}>
          {/* Frequency Selector */}
          <Pressable
            style={styles.pickerButton}
            onPress={() => setShowFrequencyPicker(true)}
          >
            <ThemedText style={styles.pickerLabel}>Frequency</ThemedText>
            <View style={styles.pickerValueContainer}>
              <ThemedText style={styles.pickerValue}>
                {options.frequency.charAt(0).toUpperCase() + options.frequency.slice(1)}
              </ThemedText>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </View>
          </Pressable>
          
          {/* Start Date Picker */}
          <Pressable
            style={styles.pickerButton}
            onPress={openStartDatePicker}
          >
            <ThemedText style={styles.pickerLabel}>Start date</ThemedText>
            <View style={styles.pickerValueContainer}>
              <ThemedText style={styles.pickerValue}>
                {formatDate(options.startDate)}
              </ThemedText>
              <Ionicons name="calendar-outline" size={16} color="#fff" />
            </View>
          </Pressable>
          
          {/* End Date Picker */}
          <Pressable
            style={styles.pickerButton}
            onPress={openEndDatePicker}
          >
            <ThemedText style={styles.pickerLabel}>End date (optional)</ThemedText>
            <View style={styles.pickerValueContainer}>
              <ThemedText style={styles.pickerValue}>
                {formatDate(options.endDate)}
              </ThemedText>
              <Ionicons name="calendar-outline" size={16} color="#fff" />
            </View>
          </Pressable>
          
          {/* Day of Month Selector for monthly/quarterly/yearly */}
          {showDayOfMonth && (
            <View style={styles.daySelector}>
              <ThemedText style={styles.daySelectorLabel}>
                Day of month
              </ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.daysScrollView}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <Pressable
                    key={day}
                    style={[
                      styles.dayButton,
                      options.dayOfMonth === day && styles.dayButtonActive
                    ]}
                    onPress={() => handleDayOfMonthChange(day)}
                  >
                    <Text style={[
                      styles.dayText,
                      options.dayOfMonth === day && styles.dayTextActive
                    ]}>
                      {day}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Day of Week Selector for weekly/biweekly */}
          {showDayOfWeek && (
            <View style={styles.daySelector}>
              <ThemedText style={styles.daySelectorLabel}>
                Day of week
              </ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.daysScrollView}
              >
                {Array.from({ length: 7 }, (_, i) => i).map(day => (
                  <Pressable
                    key={day}
                    style={[
                      styles.weekdayButton,
                      options.dayOfWeek === day && styles.dayButtonActive
                    ]}
                    onPress={() => handleDayOfWeekChange(day)}
                  >
                    <Text style={[
                      styles.dayText,
                      options.dayOfWeek === day && styles.dayTextActive
                    ]}>
                      {getDayOfWeekName(day).substr(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
      
      {/* Frequency Modal for iOS/Android */}
      <Modal
        visible={showFrequencyPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFrequencyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Frequency</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowFrequencyPicker(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].map((freq) => (
                <Pressable
                  key={freq}
                  style={styles.frequencyOption}
                  onPress={() => handleFrequencyChange(freq as RecurringFrequency)}
                >
                  <Text style={styles.frequencyText}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                  {options.frequency === freq && (
                    <Ionicons name="checkmark" size={24} color={Colors.light.tint} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Date Pickers */}
      {showStartDatePicker && Platform.OS === 'ios' && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Start Date</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowStartDatePicker(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
              </View>
              
              <View style={{ height: 200 }}>
                <DateTimePicker
                  value={tempStartDate}
                  mode="date"
                  display="spinner"
                  onChange={handleStartDateChange}
                  style={{ height: 200 }}
                  textColor="#fff"
                />
              </View>
              
              <Pressable
                style={styles.confirmButton}
                onPress={confirmStartDate}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      
      {showEndDatePicker && Platform.OS === 'ios' && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select End Date</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowEndDatePicker(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
              </View>
              
              <View style={{ height: 200 }}>
                <DateTimePicker
                  value={tempEndDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleEndDateChange}
                  style={{ height: 200 }}
                  textColor="#fff"
                />
              </View>
              
              <Pressable
                style={styles.confirmButton}
                onPress={confirmEndDate}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Android date pickers */}
      {showStartDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={options.startDate}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
        />
      )}
      
      {showEndDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={options.endDate || new Date()}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelIcon: {
    marginRight: 10,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
  },
  toggleButton: {
    padding: 4,
  },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: 'rgba(74, 226, 144, 0.3)',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  toggleThumbActive: {
    backgroundColor: Colors.light.tint,
    transform: [{ translateX: 20 }],
  },
  optionsContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  pickerLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'AeonikBlack-Regular',
  },
  pickerValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerValue: {
    fontSize: 14,
    color: '#fff',
    marginRight: 8,
    fontFamily: 'AeonikBlack-Regular',
  },
  daySelector: {
    marginTop: 16,
  },
  daySelectorLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    fontFamily: 'AeonikBlack-Regular',
  },
  daysScrollView: {
    flexGrow: 0,
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  weekdayButton: {
    minWidth: 45,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  dayButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  dayText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  dayTextActive: {
    color: '#000',
    fontFamily: 'Aeonik-Black',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#232323',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
    marginBottom: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    color: Colors.light.tint,
    fontFamily: 'Aeonik-Black',
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 300,
  },
  frequencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  frequencyText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'AeonikBlack-Regular',
  },
  datePicker: {
    height: 200,
    marginBottom: 20,
    flex: 0,
  },
  confirmButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
});

export default RecurringOptionsComponent; 