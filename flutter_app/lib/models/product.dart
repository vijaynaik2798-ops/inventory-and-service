import 'package:cloud_firestore/cloud_firestore.dart';

class Product {
  final String id;
  final String productName;
  final String category;
  final String brand;
  final String modelNumber;
  final String serialNumber;
  final int quantity;
  final int minQuantity; // For low-stock alerts
  final DateTime purchaseDate;
  final String supplier;
  final String location;
  final String status;
  final String notes;
  final List<ProductMovementLog> movementLogs;

  Product({
    required this.id,
    required this.productName,
    required this.category,
    required this.brand,
    required this.modelNumber,
    required this.serialNumber,
    required this.quantity,
    this.minQuantity = 5,
    required this.purchaseDate,
    required this.supplier,
    required this.location,
    required this.status,
    required this.notes,
    required this.movementLogs,
  });

  factory Product.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    
    var logsRaw = data['movementLogs'] as List? ?? [];
    List<ProductMovementLog> logs = logsRaw
        .map((log) => ProductMovementLog.fromMap(log as Map<String, dynamic>))
        .toList();

    return Product(
      id: doc.id,
      productName: data['productName'] ?? '',
      category: data['category'] ?? '',
      brand: data['brand'] ?? '',
      modelNumber: data['modelNumber'] ?? '',
      serialNumber: data['serialNumber'] ?? '',
      quantity: (data['quantity'] as num?)?.toInt() ?? 0,
      minQuantity: (data['minQuantity'] as num?)?.toInt() ?? 5,
      purchaseDate: (data['purchaseDate'] as Timestamp?)?.toDate() ?? DateTime.now(),
      supplier: data['supplier'] ?? '',
      location: data['location'] ?? '',
      status: data['status'] ?? 'Available',
      notes: data['notes'] ?? '',
      movementLogs: logs,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'productName': productName,
      'category': category,
      'brand': brand,
      'modelNumber': modelNumber,
      'serialNumber': serialNumber,
      'quantity': quantity,
      'minQuantity': minQuantity,
      'purchaseDate': Timestamp.fromDate(purchaseDate),
      'supplier': supplier,
      'location': location,
      'status': status,
      'notes': notes,
      'movementLogs': movementLogs.map((log) => log.toMap()).toList(),
    };
  }
}

class ProductMovementLog {
  final String type; // 'STOCK_IN', 'STOCK_OUT', 'UPDATE', 'REPAIR_SWAP'
  final int quantityChange;
  final String operatorName;
  final String notes;
  final DateTime timestamp;

  ProductMovementLog({
    required this.type,
    required this.quantityChange,
    required this.operatorName,
    required this.notes,
    required this.timestamp,
  });

  factory ProductMovementLog.fromMap(Map<String, dynamic> map) {
    return ProductMovementLog(
      type: map['type'] ?? 'UPDATE',
      quantityChange: (map['quantityChange'] as num?)?.toInt() ?? 0,
      operatorName: map['operatorName'] ?? 'System',
      notes: map['notes'] ?? '',
      timestamp: (map['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'type': type,
      'quantityChange': quantityChange,
      'operatorName': operatorName,
      'notes': notes,
      'timestamp': Timestamp.fromDate(timestamp),
    };
  }
}
