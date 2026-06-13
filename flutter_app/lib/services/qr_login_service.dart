import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:uuid/uuid.dart';

class QrLoginService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  
  /// STEP 1: Generate a unique session token for the secondary device
  String generateSessionId() {
    return const Uuid().v4();
  }

  /// STEP 2: Create a session placeholder inside Firestore that we will listen to
  Future<void> createLoginSession(String sessionId) async {
    await _db.collection('qr_login_sessions').doc(sessionId).set({
      'status': 'PENDING',
      'createdAt': FieldValue.serverTimestamp(),
      'approvedBy': null,
      'approvedUserRole': null,
      'approvedUserEmail': null,
      'authToken': null,
    });
  }

  /// STEP 3: Listen on the device requesting logon (e.g. tablet or website)
  Stream<DocumentSnapshot> listenToSession(String sessionId) {
    return _db.collection('qr_login_sessions').doc(sessionId).snapshots();
  }

  /// STEP 4: Approve the login request from a primary authenticated mobile device
  Future<void> approveLoginRequest({
    required String sessionId,
    required String uid,
    required String name,
    required String role,
    required String email,
  }) async {
    await _db.collection('qr_login_sessions').doc(sessionId).update({
      'status': 'APPROVED',
      'approvedBy': name,
      'approvedUserRole': role,
      'approvedUserEmail': email,
      'authToken': uid,
      'approvedAt': FieldValue.serverTimestamp(),
    });
  }

  /// STEP 5: Deny or revoke login request
  Future<void> rejectLoginRequest(String sessionId) async {
    await _db.collection('qr_login_sessions').doc(sessionId).update({
      'status': 'DENIED',
      'rejectedAt': FieldValue.serverTimestamp(),
    });
  }

  /// STEP 6: Remote device database tracking (For remote sign out of other screens)
  Future<void> registerLoggedInDevice({
    required String uid,
    required String deviceId,
    required String deviceName,
    required String location,
  }) async {
    await _db.collection('users').doc(uid).collection('devices').doc(deviceId).set({
      'deviceId': deviceId,
      'deviceName': deviceName,
      'location': location,
      'lastActive': FieldValue.serverTimestamp(),
    });
  }

  /// STEP 7: Remote logout (Revokes session immediately)
  Future<void> remoteLogoutUserDevice(String uid, String deviceId) async {
    await _db.collection('users').doc(uid).collection('devices').doc(deviceId).delete();
  }
}
