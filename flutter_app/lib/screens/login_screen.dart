import 'dart:async';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/qr_login_service.dart';
import 'dashboard_screen.dart';
import 'qr_scanner_view.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _qrLoginService = QrLoginService();
  
  bool _isLoading = false;
  String _activeTab = 'EMAIL'; // 'EMAIL' or 'QR'
  String? _sessionId;
  StreamSubscription<DocumentSnapshot>? _sessionSub;
  String _qrStatusMessage = "Initializing QR session...";

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _sessionSub?.cancel();
    super.dispose();
  }

  void _switchToQrLogin() async {
    setState(() {
      _activeTab = 'QR';
      _sessionId = _qrLoginService.generateSessionId();
      _qrStatusMessage = "Waiting to be scanned from active phone...";
    });

    await _qrLoginService.createLoginSession(_sessionId!);

    // Listen to approvals instantly
    _sessionSub?.cancel();
    _sessionSub = _qrLoginService.listenToSession(_sessionId!).listen((doc) {
      if (doc.exists) {
        String status = doc.get('status') ?? 'PENDING';
        if (status == 'APPROVED') {
          _sessionSub?.cancel();
          String operatorName = doc.get('approvedBy') ?? 'Staff User';
          String email = doc.get('approvedUserEmail') ?? 'staff@invservice.com';
          String role = doc.get('approvedUserRole') ?? 'Staff';
          
          _navigateToDashboard(operatorName, email, role);
        } else if (status == 'DENIED') {
          setState(() {
            _qrStatusMessage = "Login request denied by operator.";
            _sessionId = null;
          });
        }
      }
    });
  }

  void _switchToEmailLogin() {
    _sessionSub?.cancel();
    setState(() {
      _activeTab = 'EMAIL';
      _sessionId = null;
    });
  }

  void _handleEmailSubmit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("All fields are required!")),
      );
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      // Connect to genuine Firebase Auth
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      final user = credential.user;
      if (user != null) {
        // Retrieve custom user operator roles and states from Cloud Firestore
        final docSnap = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
        if (docSnap.exists) {
          final data = docSnap.data();
          final name = data?['name'] ?? 'Staff User';
          final role = data?['role'] ?? 'Staff';
          final emailVal = data?['email'] ?? user.email ?? '';
          final status = data?['status'] ?? 'active';

          if (status == 'disabled' || status == 'locked') {
            await FirebaseAuth.instance.signOut();
            throw Exception("This operator account profile has been locked or disabled.");
          }

          _navigateToDashboard(name, emailVal, role);
        } else {
          // If profile does not exist yet (e.g. registered in Firebase Auth manually), bootstrap a default role
          String role = "Staff";
          String name = "Staff User";
          if (email.contains("admin")) {
            role = "Admin";
            name = "Vijay Admin";
          } else if (email.contains("manager")) {
            role = "Manager";
            name = "Suresh Manager";
          }
          
          _navigateToDashboard(name, email, role);
        }
      } else {
        throw Exception("Auth failed, returned empty user node.");
      }
    } on FirebaseAuthException catch (e) {
      String errMsg = "Authentication failed. Please check credentials.";
      if (e.code == 'user-not-found') {
        errMsg = "No user found with this email.";
      } else if (e.code == 'wrong-password') {
        errMsg = "Incorrect password provided.";
      } else if (e.code == 'user-disabled') {
        errMsg = "This user account has been disabled.";
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(errMsg)),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll("Exception:", "").trim())),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _navigateToDashboard(String name, String email, String role) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => DashboardScreen(
          userName: name,
          userEmail: email,
          userRole: role,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.background,
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28.0),
            child: Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(28),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Brand Icon & Header
                    Icon(
                      Icons.inventory_2_rounded,
                      size: 48,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      "Inventory System Pro",
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    Text(
                      "Staff & Device Authentication Bridge",
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[500],
                          ),
                    ),
                    const SizedBox(height: 24),

                    // Custom login tabs
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: _switchToEmailLogin,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: _activeTab == 'EMAIL'
                                    ? Theme.of(context).colorScheme.primaryContainer
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                "Email Login",
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _activeTab == 'EMAIL'
                                      ? Theme.of(context).colorScheme.onPrimaryContainer
                                      : Colors.grey[600],
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: InkWell(
                            onTap: _switchToQrLogin,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: _activeTab == 'QR'
                                    ? Theme.of(context).colorScheme.primaryContainer
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                "QR Code pairing",
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _activeTab == 'QR'
                                      ? Theme.of(context).colorScheme.onPrimaryContainer
                                      : Colors.grey[600],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    if (_activeTab == 'EMAIL') ...[
                      // Email/Pass login fields
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          prefixIcon: const Icon(Icons.email_outlined),
                          labelText: "Billing Account or Staff ID",
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _passwordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          prefixIcon: const Icon(Icons.lock_person_outlined),
                          labelText: "Strong Password",
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: FilledButton(
                          onPressed: _isLoading ? null : _handleEmailSubmit,
                          style: FilledButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: _isLoading
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text("Access Workplace Space"),
                        ),
                      ),
                    ] else ...[
                      // WhatsApp-style QR Login view
                      if (_sessionId != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.grey[200]!),
                          ),
                          child: QrImageView(
                            data: "SECURE_QR_LOGIN:$_sessionId",
                            version: QrVersions.auto,
                            size: 180.0,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _qrStatusMessage,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.indigo[800],
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Refresh QR when it times out. Scan from your logged-in mobile device via 'Pair Device' in settings.",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey[500],
                          ),
                        ),
                      ] else ...[
                        IconButton(
                          iconSize: 48,
                          icon: const Icon(Icons.refresh_rounded, color: Colors.indigo),
                          onPressed: _switchToQrLogin,
                        ),
                        const Text("QR code expired. Tap to regenerate."),
                      ],
                    ],
                    
                    const SizedBox(height: 24),
                    const Divider(),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.08),
                        border: Border.all(color: Colors.amber.withOpacity(0.3)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: const [
                              Icon(Icons.info_outline, size: 16, color: Colors.amber),
                              SizedBox(width: 8),
                              Text(
                                "Using Google SSO?",
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.amber,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            "If you log in via Google Workspace Single Sign-On, you can connect this APK instantly using Companion QR Pairing:\n"
                            "1. Select the 'QR Code pairing' tab above.\n"
                            "2. Log into the Web App on your computer/laptop using Google SSO.\n"
                            "3. Click the Scanner icon in the top right of the Web App, and scan this phone's QR code.\n"
                            "This instantly authorizes and logs you into the APK!",
                            style: TextStyle(
                              fontSize: 10,
                              height: 1.4,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
