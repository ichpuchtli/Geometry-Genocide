_doc__ = 'Creates an instance of the App class, loads the main menu and \
enters main loop.'
	
from interface import Interface
from library import Time


class App(Interface):
	'Application Class '

	def loop(self):
		""" Main Loop """
		self.load_main_menu()

		# Initiate Time
		self.clock = Time()
		
		while self._loop:
	
			# Main Loop Time Delta
			self.clock.grandfather()
			self.clock.reset()
			
			# Events
			for event in self.events():
				self.on_event(event)
			
			# Render
			self.background()

			self.user_interface()
			
			self.battlefield()

			# Double Buffer 
			self.flip()
			
		# Close Application after main loop is terminated
		self.window_close()

if __name__ == '__main__' :
	
	game = App()
	game.loop()
	
	
