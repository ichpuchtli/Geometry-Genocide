__doc__ = 'Creates an instance of the App class, loads the main menu and \
enters main loop.'
	
from interface import Interface
from library import Time


class App():
	'Application Class '

	def __init__(self):
		self.app = Interface()

	def loop(self):
		""" Main Loop """
		self.app.load_main_menu()

		# Initiate Time
		self.clock = Time()
		
		while self.app._loop:
	
			# Main Loop Time Delta
			self.clock.grandfather()
			self.clock.reset()
			
			# Events
			for event in self.app.events():
				self.app.on_event(event)
			
			# Render
			self.app.background()

			self.app.user_interface()
			
			self.app.battlefield()

			# Double Buffer 
			self.app.flip()
			
		# Close Application after main loop is terminated
		self.app.window_close()

if __name__ == '__main__' :
	
	game = App()
	game.loop()
	
	
