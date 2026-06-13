import 'package:flutter/material.dart';
import '../services/firebase_service.dart';
import '../models/product.dart';
import 'qr_scanner_view.dart';

class InventoryScreen extends StatefulWidget {
  final String userRole;
  final String userName;

  const InventoryScreen({
    Key? key,
    required this.userRole,
    required this.userName,
  }) : super(key: key);

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final FirebaseService _firebaseService = FirebaseService();
  String _searchQuery = "";
  String _selectedCategory = "All";
  List<Product> _allProducts = [];

  final _nameController = TextEditingController();
  final _categoryController = TextEditingController();
  final _brandController = TextEditingController();
  final _modelController = TextEditingController();
  final _serialController = TextEditingController();
  final _quantityController = TextEditingController();
  final _supplierController = TextEditingController();
  final _locationController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _categoryController.dispose();
    _brandController.dispose();
    _modelController.dispose();
    _serialController.dispose();
    _quantityController.dispose();
    _supplierController.dispose();
    _locationController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _triggerBarcodeScanner(TextEditingController targetController) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => QrScannerView(
          title: "Scan Product Barcode/QR",
          onScanComplete: (code) {
            setState(() {
              targetController.text = code;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text("Scanned successfully: $code")),
            );
          },
        ),
      ),
    );
  }

  void _showAddProductDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          scrollable: true,
          title: const Text("Register Product SKU"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: "Product Name *"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _brandController,
                decoration: const InputDecoration(labelText: "Brand *"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _categoryController,
                decoration: const InputDecoration(labelText: "Category / Type"),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _modelController,
                      decoration: const InputDecoration(labelText: "Model Number"),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.qr_code_scanner),
                    onPressed: () => _triggerBarcodeScanner(_modelController),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _serialController,
                      decoration: const InputDecoration(labelText: "Barcode / Serial No"),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.qr_code_scanner),
                    onPressed: () => _triggerBarcodeScanner(_serialController),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _quantityController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "Initial stock count *"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _locationController,
                decoration: const InputDecoration(labelText: "Aisle / Storage Spot"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _supplierController,
                decoration: const InputDecoration(labelText: "Partner / Supplier"),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _notesController,
                maxLines: 2,
                decoration: const InputDecoration(labelText: "Notes"),
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
                if (_nameController.text.trim().isEmpty || _quantityController.text.trim().isEmpty) {
                  return;
                }
                
                final int initialQty = int.tryParse(_quantityController.text) ?? 1;

                final newProd = Product(
                  id: "SKU_${DateTime.now().millisecondsSinceEpoch}",
                  productName: _nameController.text.trim(),
                  category: _categoryController.text.trim().isEmpty ? "General" : _categoryController.text.trim(),
                  brand: _brandController.text.trim(),
                  modelNumber: _modelController.text.trim(),
                  serialNumber: _serialController.text.trim(),
                  quantity: initialQty,
                  purchaseDate: DateTime.now(),
                  supplier: _supplierController.text.trim(),
                  location: _locationController.text.trim().isEmpty ? "Main Room" : _locationController.text.trim(),
                  status: "Available",
                  notes: _notesController.text.trim(),
                  movementLogs: [
                    ProductMovementLog(
                      type: 'STOCK_IN',
                      quantityChange: initialQty,
                      operatorName: widget.userName,
                      notes: 'Initial inventory launch registration',
                      timestamp: DateTime.now(),
                    )
                  ],
                );

                await _firebaseService.addProduct(newProd);
                _clearFields();
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("SKU registered and saved on Firestore! ☁")),
                );
              },
              child: const Text("Save Item"),
            ),
          ],
        );
      },
    );
  }

  void _clearFields() {
    _nameController.clear();
    _categoryController.clear();
    _brandController.clear();
    _modelController.clear();
    _serialController.clear();
    _quantityController.clear();
    _supplierController.clear();
    _locationController.clear();
    _notesController.clear();
  }

  void _showStockInOutSheet(Product product, bool isStockIn) {
    final qtyController = TextEditingController();
    final logNotesController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                isStockIn ? "Stock-In Transaction" : "Stock-Out Transaction",
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 4),
              Text(
                "Adjusting inventory levels for ${product.productName}.",
                style: const TextStyle(color: Colors.grey, fontSize: 11),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: qtyController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "Quantity *"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: logNotesController,
                decoration: const InputDecoration(labelText: "Notes / Bill Ref / Memo"),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () async {
                  final int change = int.tryParse(qtyController.text) ?? 0;
                  if (change <= 0) return;

                  try {
                    if (isStockIn) {
                      await _firebaseService.stockIn(product.id, change, widget.userName, logNotesController.text);
                    } else {
                      await _firebaseService.stockOut(product.id, change, widget.userName, logNotesController.text);
                    }
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Physical count synced securely.")),
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text("Error: ${e.toString()}")),
                    );
                  }
                },
                child: Text(isStockIn ? "Execute Stock In" : "Execute Stock Out"),
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
        title: const Text("Inventory Repository"),
        actions: [
          IconButton(
            tooltip: "Filter via Scan",
            icon: const Icon(Icons.search_rounded),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => QrScannerView(
                    title: "Scan SKU barcode to view",
                    onScanComplete: (code) {
                      setState(() {
                        _searchQuery = code;
                      });
                    },
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter & Search Header
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                Expanded(
                  child: SearchBar(
                    hintText: "Search by Name, SKU, Model",
                    leading: const Icon(Icons.search),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val.toLowerCase();
                      });
                    },
                  ),
                ),
              ],
            ),
          ),

          // Catalog Listing
          Expanded(
            child: StreamBuilder<List<Product>>(
              stream: _firebaseService.streamProducts(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                
                final products = snapshot.data ?? [];
                final filtered = products.where((prod) {
                  final queryMatched = prod.productName.toLowerCase().contains(_searchQuery) ||
                                       prod.brand.toLowerCase().contains(_searchQuery) ||
                                       prod.modelNumber.toLowerCase().contains(_searchQuery) ||
                                       prod.serialNumber.toLowerCase().contains(_searchQuery);
                  return queryMatched;
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(
                    child: Text("No product listings found in inventory."),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    return Card(
                      child: ListTile(
                        title: Text(
                          item.productName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        subtitle: Text(
                          "SKU: ${item.id} | Model: ${item.modelNumber} | BRAND: ${item.brand}\nLoc: ${item.location} | Purc: ${item.supplier}",
                          style: const TextStyle(fontSize: 10, color: Colors.grey),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              "${item.quantity} units",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: item.quantity <= item.minQuantity ? Colors.deepOrange : Colors.green[800],
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.add_box, color: Colors.green, size: 20),
                                  onPressed: () => _showStockInOutSheet(item, true),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.indeterminate_check_box, color: Colors.red, size: 20),
                                  onPressed: () => _showStockInOutSheet(item, false),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: (widget.userRole == 'Admin' || widget.userRole == 'Manager')
          ? FloatingActionButton(
              onPressed: _showAddProductDialog,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
extension on SearchBar {
  // Adaptation properties
}
