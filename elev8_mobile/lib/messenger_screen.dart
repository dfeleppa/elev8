import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'components/sidebar_shell.dart';
import 'components/bottom_nav_bar.dart';

class MessengerScreen extends ConsumerWidget {
  const MessengerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          title: const Text('Messages', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24.0),
            child: Center(
              child: Text(
                'Direct Messaging coming soon...',
                style: TextStyle(color: Colors.white54, fontSize: 16),
              ),
            ),
          ),
        ),
        // Messenger is not a top-level tab in the new 4-tab layout — only
        // reachable via deep link. Default to Home so the bottom bar isn't
        // showing a stale "Coach" selection.
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 0),
      ),
    );
  }
}
