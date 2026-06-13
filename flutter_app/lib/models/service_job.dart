import 'package:cloud_firestore/cloud_firestore.dart';

class ServiceJobModel {
  final String id; // Job reference key, e.g. "INVSRV-2026-0001"
  final String customerId;
  final String customerName;
  final DateTime date;
  final String paymentStatus; // "Unpaid", "Partial", "Paid"
  final String paymentMethod; // "Cash", "UPI", "Card", "Bank Transfer"
  final double grandTotal;
  final double paidAmount;
  final List<ServiceItem> items;

  ServiceJobModel({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.date,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.grandTotal,
    required this.paidAmount,
    required this.items,
  });

  factory ServiceJobModel.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    var itemsRaw = data['items'] as List? ?? [];
    List<ServiceItem> serviceItems = itemsRaw
        .map((item) => ServiceItem.fromMap(item as Map<String, dynamic>))
        .toList();

    return ServiceJobModel(
      id: doc.id,
      customerId: data['customerId'] ?? '',
      customerName: data['customerName'] ?? '',
      date: (data['date'] as Timestamp?)?.toDate() ?? DateTime.now(),
      paymentStatus: data['paymentStatus'] ?? 'Unpaid',
      paymentMethod: data['paymentMethod'] ?? 'Cash',
      grandTotal: (data['grandTotal'] as num?)?.toDouble() ?? 0.0,
      paidAmount: (data['paidAmount'] as num?)?.toDouble() ?? 0.0,
      items: serviceItems,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'customerId': customerId,
      'customerName': customerName,
      'date': Timestamp.fromDate(date),
      'paymentStatus': paymentStatus,
      'paymentMethod': paymentMethod,
      'grandTotal': grandTotal,
      'paidAmount': paidAmount,
      'items': items.map((item) => item.toMap()).toList(),
    };
  }
}

class ServiceItem {
  final String id;
  final String productName;
  final String brand;
  final String modelNo;
  final String serialNo;
  final String condition;
  final String problemDescription;
  final double serviceCharge;
  final double spareCharge;
  final double discount;
  final double total;
  final String technicianId;
  final String technicianName;
  final String status; // "Received", "Under Inspection", "Repairing", "Waiting for Parts", "Completed", "Delivered"
  final String currentLocation;
  final List<ComponentReplacement> replacements;

  ServiceItem({
    required this.id,
    required this.productName,
    required this.brand,
    required this.modelNo,
    required this.serialNo,
    required this.condition,
    required this.problemDescription,
    required this.serviceCharge,
    required this.spareCharge,
    required this.discount,
    required this.total,
    required this.technicianId,
    required this.technicianName,
    required this.status,
    required this.currentLocation,
    required this.replacements,
  });

  factory ServiceItem.fromMap(Map<String, dynamic> map) {
    var rawReps = map['replacements'] as List? ?? [];
    List<ComponentReplacement> reps = rawReps
        .map((rep) => ComponentReplacement.fromMap(rep as Map<String, dynamic>))
        .toList();

    return ServiceItem(
      id: map['id'] ?? '',
      productName: map['productName'] ?? '',
      brand: map['brand'] ?? '',
      modelNo: map['modelNo'] ?? '',
      serialNo: map['serialNo'] ?? '',
      condition: map['condition'] ?? '',
      problemDescription: map['problemDescription'] ?? '',
      serviceCharge: (map['serviceCharge'] as num?)?.toDouble() ?? 0.0,
      spareCharge: (map['spareCharge'] as num?)?.toDouble() ?? 0.0,
      discount: (map['discount'] as num?)?.toDouble() ?? 0.0,
      total: (map['total'] as num?)?.toDouble() ?? 0.0,
      technicianId: map['technicianId'] ?? '',
      technicianName: map['technicianName'] ?? '',
      status: map['status'] ?? 'Received',
      currentLocation: map['currentLocation'] ?? 'Store Room',
      replacements: reps,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'productName': productName,
      'brand': brand,
      'modelNo': modelNo,
      'serialNo': serialNo,
      'condition': condition,
      'problemDescription': problemDescription,
      'serviceCharge': serviceCharge,
      'spareCharge': spareCharge,
      'discount': discount,
      'total': total,
      'technicianId': technicianId,
      'technicianName': technicianName,
      'status': status,
      'currentLocation': currentLocation,
      'replacements': replacements.map((r) => r.toMap()).toList(),
    };
  }
}

class ComponentReplacement {
  final String id;
  final String partName;
  final String oldSerial;
  final String newSerial;
  final String oldModel;
  final String newModel;
  final String reason;
  final DateTime timestamp;

  ComponentReplacement({
    required this.id,
    required this.partName,
    required this.oldSerial,
    required this.newSerial,
    required this.oldModel,
    required this.newModel,
    required this.reason,
    required this.timestamp,
  });

  factory ComponentReplacement.fromMap(Map<String, dynamic> map) {
    return ComponentReplacement(
      id: map['id'] ?? '',
      partName: map['partName'] ?? '',
      oldSerial: map['oldSerial'] ?? '',
      newSerial: map['newSerial'] ?? '',
      oldModel: map['oldModel'] ?? '',
      newModel: map['newModel'] ?? '',
      reason: map['reason'] ?? '',
      timestamp: (map['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'partName': partName,
      'oldSerial': oldSerial,
      'newSerial': newSerial,
      'oldModel': oldModel,
      'newModel': newModel,
      'reason': reason,
      'timestamp': Timestamp.fromDate(timestamp),
    };
  }
}
