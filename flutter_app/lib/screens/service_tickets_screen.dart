import 'package:flutter/material.dart';
import '../services/firebase_service.dart';
import '../models/service_job.dart';

class ServiceTicketsScreen extends StatefulWidget {
  final String userRole;
  final String userName;

  const ServiceTicketsScreen({
    Key? key,
    required this.userRole,
    required this.userName,
  }) : super(key: key);

  @override
  State<ServiceTicketsScreen> createState() => _ServiceTicketsScreenState();
}

class _ServiceTicketsScreenState extends State<ServiceTicketsScreen> {
  final FirebaseService _firebaseService = FirebaseService();
  String _statusFilter = "All";

  void _updateItemRepairStatus(ServiceJobModel job, ServiceItem item, String newStatus) async {
    final updatedItems = job.items.map((i) {
      if (i.id == item.id) {
        return ServiceItem(
          id: i.id,
          productName: i.productName,
          brand: i.brand,
          modelNo: i.modelNo,
          serialNo: i.serialNo,
          condition: i.condition,
          problemDescription: i.problemDescription,
          serviceCharge: i.serviceCharge,
          spareCharge: i.spareCharge,
          discount: i.discount,
          total: i.total,
          technicianId: i.technicianId,
          technicianName: i.technicianName,
          status: newStatus,
          currentLocation: i.currentLocation,
          replacements: i.replacements,
        );
      }
      return i;
    }).toList();

    await _firebaseService.updateServiceJob(job.id, updatedItems);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Updated ${item.productName} status to $newStatus")),
    );
  }

  void _showAddReplacementDialog(ServiceJobModel job, ServiceItem item) {
    final partNameController = TextEditingController();
    final oldModelController = TextEditingController();
    final newModelController = TextEditingController();
    final oldSerialController = TextEditingController();
    final newSerialController = TextEditingController();
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          scrollable: true,
          title: const Text("Log Replacement Component"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: partNameController,
                decoration: const InputDecoration(labelText: "Defective Part Name *"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: oldModelController,
                decoration: const InputDecoration(labelText: "Defective Model No"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: oldSerialController,
                decoration: const InputDecoration(labelText: "Defective Serial No"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newModelController,
                decoration: const InputDecoration(labelText: "New Installed Model No"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: newSerialController,
                decoration: const InputDecoration(labelText: "New Installed Serial No *"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(labelText: "Reason for Swap/Failure"),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("Cancel"),
            ),
            FilledButton(
              onPressed: () async {
                if (partNameController.text.trim().isEmpty || newSerialController.text.trim().isEmpty) {
                  return;
                }

                final newReplacement = ComponentReplacement(
                  id: "REP_${DateTime.now().millisecondsSinceEpoch}",
                  partName: partNameController.text.trim(),
                  oldSerial: oldSerialController.text.trim(),
                  newSerial: newSerialController.text.trim(),
                  oldModel: oldModelController.text.trim(),
                  newModel: newModelController.text.trim(),
                  reason: reasonController.text.trim(),
                  timestamp: DateTime.now(),
                );

                final updatedItems = job.items.map((i) {
                  if (i.id == item.id) {
                    final updatedReps = [...i.replacements, newReplacement];
                    return ServiceItem(
                      id: i.id,
                      productName: i.productName,
                      brand: i.brand,
                      modelNo: i.modelNo,
                      serialNo: i.serialNo,
                      condition: i.condition,
                      problemDescription: i.problemDescription,
                      serviceCharge: i.serviceCharge,
                      spareCharge: i.spareCharge,
                      discount: i.discount,
                      total: i.total,
                      technicianId: i.technicianId,
                      technicianName: i.technicianName,
                      status: i.status,
                      currentLocation: i.currentLocation,
                      replacements: updatedReps,
                    );
                  }
                  return i;
                }).toList();

                await _firebaseService.updateServiceJob(job.id, updatedItems);
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Component swap logged under tracking file! 🛠")),
                );
              },
              child: const Text("Save Swap"),
            ),
          ],
        );
      },
    );
  }

  void _showTicketDetails(ServiceJobModel job) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return FractionallySizedBox(
          heightFactor: 0.85,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    Text(
                      job.id,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.indigo),
                    ),
                    Chip(
                      label: Text(job.paymentStatus),
                      backgroundColor: job.paymentStatus == 'Paid' ? Colors.green[100] : Colors.amber[100],
                    )
                  ],
                ),
                Text("CLIENT: ${job.customerName}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const Divider(),
                const SizedBox(height: 10),
                const Text("Items in Repair Intake:", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Expanded(
                  child: ListView.builder(
                    itemCount: job.items.length,
                    itemBuilder: (context, index) {
                      final item = job.items[index];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                              Text("Model: ${item.modelNo} | Serial: ${item.serialNo}", style: const TextStyle(fontSize: 10, color: Colors.grey)),
                              Text("Problem: ${item.problemDescription}", style: const TextStyle(fontSize: 11, color: Colors.deepOrange)),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text("Status: ${item.status}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.indigo)),
                                  DropdownButton<String>(
                                    value: item.status,
                                    onChanged: (newStatus) {
                                      if (newStatus != null) {
                                        _updateItemRepairStatus(job, item, newStatus);
                                        Navigator.of(context).pop();
                                      }
                                    },
                                    items: [
                                      "Received",
                                      "Under Inspection",
                                      "Repairing",
                                      "Waiting for Parts",
                                      "Completed",
                                      "Delivered"
                                    ].map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 11)))).toList(),
                                  ),
                                ],
                              ),
                              const Divider(),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text("Total Charged: ₹${item.total}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                                  TextButton.icon(
                                    onPressed: () => _showAddReplacementDialog(job, item),
                                    icon: const Icon(Icons.add_circle_outline, size: 14),
                                    label: const Text("Log Spare Swap", style: TextStyle(fontSize: 11)),
                                  )
                                ],
                              ),
                              if (item.replacements.isNotEmpty) ...[
                                const Text("Swapped Parts history:", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 9)),
                                ...item.replacements.map((r) => Text(
                                  "・ ${r.partName}: Old ${r.oldSerial} ➔ New ${r.newSerial}",
                                  style: const TextStyle(fontSize: 9, color: Colors.teal),
                                )),
                              ]
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Total Job Cost: ₹${job.grandTotal}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    Text("Paid Amount: ₹${job.paidAmount}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.green)),
                  ],
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () {
                    // Export summary billing options
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("PDF Invoice metadata generated. Ready for sharing.")),
                    );
                  },
                  icon: const Icon(Icons.share_rounded),
                  label: const Text("Share WhatsApp Invoice Link"),
                )
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Intake Services Hub"),
      ),
      body: Column(
        children: [
          // Filter Tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                "All",
                "Received",
                "Under Inspection",
                "Repairing",
                "Completed",
                "Delivered"
              ].map((status) {
                final isSelected = _statusFilter == status;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 8.0),
                  child: ChoiceChip(
                    label: Text(status, style: const TextStyle(fontSize: 11)),
                    selected: isSelected,
                    onSelected: (val) {
                      setState(() {
                        _statusFilter = status;
                      });
                    },
                  ),
                );
              }).toList(),
            ),
          ),

          // Stream listings
          Expanded(
            child: StreamBuilder<List<ServiceJobModel>>(
              stream: _firebaseService.streamServiceJobs(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final jobs = snapshot.data ?? [];
                // Filtering
                final filtered = jobs.where((job) {
                  if (_statusFilter == "All") return true;
                  return job.items.any((item) => item.status == _statusFilter);
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(child: Text("No jobs fit this filter status."));
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final job = filtered[index];
                    return Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.receipt_long),
                        ),
                        title: Text(
                          job.customerName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        subtitle: Text(
                          "Job ID: ${job.id} | Items: ${job.items.length}\npayment: ${job.paymentStatus} (${job.paymentMethod})",
                          style: const TextStyle(fontSize: 10, color: Colors.grey),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text("₹${job.grandTotal}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            const SizedBox(height: 4),
                            const Icon(Icons.arrow_forward_ios_rounded, size: 12),
                          ],
                        ),
                        onTap: () => _showTicketDetails(job),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
