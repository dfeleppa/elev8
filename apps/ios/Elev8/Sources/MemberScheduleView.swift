import SwiftUI

struct MemberScheduleView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.scenePhase) private var scenePhase
    @State private var date = Date()
    @State private var schedule: MemberSchedule?
    @State private var loading = false
    @State private var submitting = false
    @State private var uncertain = false
    @State private var error: String?
    @State private var cancellation: MemberClass?

    var body: some View {
        List {
            Section {
                DatePicker("Class date", selection: $date, displayedComponents: .date)
                    .environment(\.timeZone, MemberDate.gymTimeZone)
                    .disabled(submitting)
                Text("Class times are shown in the gym's time zone (New York).").font(.footnote).foregroundStyle(.secondary)
            }
            if loading { ProgressView("Loading classes…") }
            if let error {
                Section { Text(error).foregroundStyle(.red); Button("Refresh schedule") { Task { await load() } }.disabled(loading || submitting) }
            }
            if let schedule {
                if schedule.sessions.isEmpty { Text("No classes scheduled for this date.").foregroundStyle(.secondary) }
                ForEach(schedule.sessions) { item in
                    Section {
                        Text(item.name).font(.headline)
                        Text("\(item.classTime) · \(item.durationMinutes) minutes")
                        Text(item.availabilityLabel).foregroundStyle(item.isReserved ? Color.green : Color.secondary)
                        if item.isReserved {
                            Button("Cancel reservation", role: .destructive) { cancellation = item }.disabled(!item.canCancel || submitting || loading || uncertain)
                        } else {
                            Button(submitting ? "Updating…" : "Book class") { Task { await change(item, cancel: false) } }
                                .disabled(!item.canBook || submitting || loading || uncertain)
                        }
                    }
                }
            }
        }
        .navigationTitle("Schedule")
        .task(id: MemberDate.key(date)) { await load() }
        .refreshable { await load() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await load() } } }
        .confirmationDialog("Cancel this reservation?", isPresented: Binding(get: { cancellation != nil }, set: { if !$0 { cancellation = nil } }), titleVisibility: .visible) {
            if let item = cancellation { Button("Cancel reservation", role: .destructive) { Task { await change(item, cancel: true) }; cancellation = nil } }
            Button("Keep reservation", role: .cancel) { cancellation = nil }
        }
    }

    private func load() async {
        guard !submitting else { return }
        let key = MemberDate.key(date)
        loading = true; error = nil; schedule = nil
        defer { if key == MemberDate.key(date) { loading = false } }
        do {
            let result: MemberSchedule = try await session.request("api/v1/member/schedule?date=\(key)")
            guard !Task.isCancelled && key == MemberDate.key(date) else { return }
            schedule = result; uncertain = false
        } catch {
            guard !Task.isCancelled && key == MemberDate.key(date) else { return }
            self.error = (error as? APIError)?.message ?? "Schedule could not be refreshed. Check your connection and retry."
        }
    }

    private func change(_ item: MemberClass, cancel: Bool) async {
        guard !submitting && !loading && !uncertain && (cancel ? item.canCancel : item.canBook) else { return }
        submitting = true; error = nil
        do {
            let operationId = UUID()
            if cancel {
                guard let reservationId = item.reservationId else { submitting = false; return }
                let _: MemberReservationResponse = try await session.request("api/v1/member/schedule/reservations/\(reservationId)", method: "DELETE", body: JSONEncoder().encode(MemberCancellationInput(operationId: operationId)))
            } else {
                let input = MemberReservationInput(classId: item.classId, date: item.date, operationId: operationId)
                let _: MemberReservationResponse = try await session.request("api/v1/member/schedule/reservations", method: "POST", body: JSONEncoder().encode(input))
            }
        } catch {
            uncertain = true
            let reason = (error as? APIError)?.message ?? "The change could not be confirmed."
            self.error = "\(reason) Refresh the schedule to check your reservation before trying again."
            submitting = false
            return
        }
        submitting = false
        await load()
    }
}
