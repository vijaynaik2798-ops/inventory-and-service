import 'package:flutter/material.dart';
import '../services/qr_login_service.dart';
import '../services/firebase_service.dart';
import '../models/product.dart';
import 'inventory_screen.dart';
import 'service_tickets_screen.dart';
import 'qr_scanner_view.dart';

class DashboardScreen extends StatefulWidget {
  final String userName;
  final String userEmail;
  final String userRole;

  const DashboardScreen({
    Key? key,
    required this.userName,
    required this.userEmail,
    required this.userRole,
  }) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final FirebaseService _firebaseService = FirebaseService();
  final QrLoginService _qrLoginService = QrLoginService();
  
  int _outOfStockCount = 0;
  int _activeJobsCount = 0;
  List<Product> _lowStockItems = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardInsights();
  }

  void _loadDashboardInsights() {
    // Listen to real-time syncs
    _firebaseService.streamProducts().listen((products) {
      if (mounted) {
        setState(() {
          _lowStockItems = products.where((p) => p.quantity <= p.minQuantity).toList();
          _outOfStockCount = products.where((p) => p.quantity == 0).length;
        });
      }
    });

    _firebaseService.streamServiceJobs().listen((jobs) {
      if (mounted) {
        setState(() {
          _activeJobsCount = jobs.where((job) => job.items.any((item) => item.status != 'Completed' && item.status != 'Delivered')).length;
        });
      }
    });
  }

  /// Trigger QR Scanner to pair secondary devices (WhatsApp-style device connection)
  void _scanToPairDevice() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => QrScannerView(
          title: "Scan Companion QR Screen",
          onScanComplete: (scannedData) async {
            if (scannedData.startsWith("SECURE_QR_LOGIN:") || scannedData.startsWith("STOCKIVO-QR-LOGIN-REQ:")) {
              final sessionId = scannedData
                  .replaceFirst("SECURE_QR_LOGIN:", "")
                  .replaceFirst("STOCKIVO-QR-LOGIN-REQ:", "");
              _showApprovalSheet(sessionId);
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Invalid login validation token format!")),
              );
            }
          },
        ),
      ),
    );
  }

  void _showApprovalSheet(String sessionId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.emerald[50],
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.devices_other_rounded, color: Colors.emerald),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    "Link New Companion?",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                "Scanning this QR will instantly authorize this worker account session on the companion device. Do you trust this device connection request?",
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        await _qrLoginService.rejectLoginRequest(sessionId);
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("Request rejected safely.")),
                        );
                      },
                      child: const Text("Deny"),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.emerald,
                      ),
                      onPressed: () async {
                        await _qrLoginService.approveLoginRequest(
                          sessionId: sessionId,
                          uid: "${widget.userName.toLowerCase().replaceAll(' ', '_')}_id",
                          name: widget.userName,
                          role: widget.userRole,
                          email: widget.userEmail,
                        );
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("Auth Request Approved and Synced! ☁")),
                        );
                      },
                      child: const Text("Approve Login"),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Inventory & Service Matrix",
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: Colors.emerald,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  "Cloud Firestore Connected",
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.grey[500],
                        fontSize: 8,
                      ),
                ),
              ],
            )
          ],
        ),
        actions: [
          IconButton(
            tooltip: "WhatsApp QR login pairing link option",
            icon: const Icon(Icons.qr_code_scanner_rounded),
            onPressed: _scanToPairDevice,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Logged User Stats Card
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
                      child: Text(
                        widget.userName[0].toUpperCase(),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primaryContainer,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Welcome, ${widget.userName}",
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onPrimaryContainer,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            "Role: ${widget.userRole} | ID: ${widget.userEmail}",
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onPrimaryContainer.withOpacity(0.7),
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Chip(
                      label: Text(widget.userRole),
                      backgroundColor: Theme.of(context).colorScheme.surface,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Performance Statistics metrics
            Text(
              "Operational Overview",
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.black,
                    fontSize: 12,
                    letterSpacing: 0.5,
                  ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Low Stock SKUs", style: TextStyle(fontSize: 11, color: Colors.grey)),
                          const SizedBox(height: 4),
                          Text(
                            "${_lowStockItems.length}",
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Colors.deepOrange),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Out of Stock", style: TextStyle(fontSize: 11, color: Colors.grey)),
                          const SizedBox(height: 4),
                          Text(
                            "$_outOfStockCount",
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Colors.red),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Active Repairs", style: TextStyle(fontSize: 11, color: Colors.grey)),
                          const SizedBox(height: 4),
                          Text(
                            "$_activeJobsCount",
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Colors.indigo),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Quick Operations grid
            Text(
              "Management Portals",
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.black,
                    fontSize: 12,
                    letterSpacing: 0.5,
                  ),
            ),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.5,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              children: [
                InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => InventoryScreen(
                          userRole: widget.userRole,
                          userName: widget.userName,
                        ),
                      ),
                    );
                  },
                  child: Card(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.inventory, color: Theme.of(context).colorScheme.primary),
                        const SizedBox(height: 4),
                        const Text("Inventory Core", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
                InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ServiceTicketsScreen(
                          userRole: widget.userRole,
                          userName: widget.userName,
                        ),
                      ),
                    );
                  },
                  child: Card(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.engineering, color: Theme.of(context).colorScheme.secondary),
                        const SizedBox(height: 4),
                        const Text("Service Tickets", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Active low stock warnings alert list
            if (_lowStockItems.isNotEmpty) ...[
              Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.orangeAccent),
                  const SizedBox(width: 8),
                  Text(
                    "Low Stock Warnings",
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.black,
                          fontSize: 12,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _lowStockItems.length,
                itemBuilder: (context, index) {
                  final item = _lowStockItems[index];
                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      side: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      title: Text(item.productName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      subtitle: Text("Model: ${item.modelNumber} | Loc: ${item.location}", style: const TextStyle(fontSize: 9)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.red[50],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          "${item.quantity} Left",
                          style: TextStyle(color: Colors.red[800], fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
enum CardVariant { outlined, filled }
extension on Card {
  // Simple styling adapter of Cards
}
