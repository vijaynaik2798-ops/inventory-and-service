import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/product.dart';
import '../models/customer.dart';
import '../models/service_job.dart';

class FirebaseService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // Real-time synchronization stream of Products
  Stream<List<Product>> streamProducts() {
    return _db.collection('inventory').snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => Product.fromFirestore(doc)).toList();
    });
  }

  // Real-time synchronization stream of Customers
  Stream<List<CustomerModel>> streamCustomers() {
    return _db.collection('customers').snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => CustomerModel.fromFirestore(doc)).toList();
    });
  }

  // Real-time synchronization stream of Service Jobs
  Stream<List<ServiceJobModel>> streamServiceJobs() {
    return _db.collection('service_jobs').orderBy('date', descending: true).snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => ServiceJobModel.fromFirestore(doc)).toList();
    });
  }

  // Stock In operation
  Future<void> stockIn(String productId, int addQuantity, String operatorName, String notes) async {
    DocumentReference productRef = _db.collection('inventory').doc(productId);
    
    await _db.runTransaction((transaction) async {
      DocumentSnapshot snapshot = await transaction.get(productRef);
      if (!snapshot.exists) {
        throw Exception("Product does not exist!");
      }
      
      int currentQty = (snapshot.get('quantity') as num).toInt();
      int newQty = currentQty + addQuantity;
      
      var logsRaw = snapshot.get('movementLogs') as List? ?? [];
      List<Map<String, dynamic>> logs = logsRaw.map((e) => Map<String, dynamic>.from(e)).toList();
      
      // Add log
      logs.add({
        'type': 'STOCK_IN',
        'quantityChange': addQuantity,
        'operatorName': operatorName,
        'notes': notes,
        'timestamp': Timestamp.now(),
      });
      
      transaction.update(productRef, {
        'quantity': newQty,
        'movementLogs': logs,
      });
    });
  }

  // Stock Out operation representing products taken out
  Future<void> stockOut(String productId, int subtractQuantity, String operatorName, String notes) async {
    DocumentReference productRef = _db.collection('inventory').doc(productId);
    
    await _db.runTransaction((transaction) async {
      DocumentSnapshot snapshot = await transaction.get(productRef);
      if (!snapshot.exists) {
        throw Exception("Product does not exist!");
      }
      
      int currentQty = (snapshot.get('quantity') as num).toInt();
      if (currentQty < subtractQuantity) {
        throw Exception("Insufficient stock parameters! Available: $currentQty");
      }
      
      int newQty = currentQty - subtractQuantity;
      var logsRaw = snapshot.get('movementLogs') as List? ?? [];
      List<Map<String, dynamic>> logs = logsRaw.map((e) => Map<String, dynamic>.from(e)).toList();
      
      // Add log
      logs.add({
        'type': 'STOCK_OUT',
        'quantityChange': -subtractQuantity,
        'operatorName': operatorName,
        'notes': notes,
        'timestamp': Timestamp.now(),
      });
      
      transaction.update(productRef, {
        'quantity': newQty,
        'movementLogs': logs,
      });
    });
  }

  // Create or register a Product
  Future<void> addProduct(Product product) async {
    await _db.collection('inventory').doc(product.id.isEmpty ? null : product.id).set(product.toMap());
  }

  // Update a Product
  Future<void> updateProduct(String id, Map<String, dynamic> data) async {
    await _db.collection('inventory').doc(id).update(data);
  }

  // Create a Customer
  Future<void> addCustomer(CustomerModel customer) async {
    await _db.collection('customers').doc(customer.id.isEmpty ? null : customer.id).set(customer.toMap());
  }

  // Add a Service Ticket
  Future<void> createServiceJob(ServiceJobModel job) async {
    await _db.collection('service_jobs').doc(job.id).set(job.toMap());
  }

  // Update Service Job item status or details
  Future<void> updateServiceJob(String jobID, List<ServiceItem> updatedItems) async {
    await _db.collection('service_jobs').doc(jobID).update({
      'items': updatedItems.map((item) => item.toMap()).toList(),
    });
  }

  // Enable offline features
  Future<void> configureOfflineSync() async {
    // Firestore enables cache synchronization natively by default on mobile platforms
    _db.settings = const Settings(
      persistenceEnabled: true,
      cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
    );
  }
}
